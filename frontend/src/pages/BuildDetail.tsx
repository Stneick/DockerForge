import { lazy, Suspense, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { FileCode2, Box, Info } from 'lucide-react';

import { useBuild } from '@/api/hooks';
import { useBuildNumbers } from '@/hooks/useBuildNumbers';
import { qk } from '@/api/queryKeys';
import {
    formatBytes,
    formatDuration,
    formatElapsed,
    shortId,
} from '@/lib/format';
import { useBuildStream } from '@/hooks/useBuildStream';
import { useWorkbenchTab } from '@/components/workbench/useWorkbenchTab';
import { StatusBadge, StatusDot } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/misc';
import { CenteredSpinner } from '@/components/ui/Skeleton';
import { EditorToolbar, FileTab } from '@/components/forge/EditorChrome';
import {
    Dock,
    Inspector,
    InspectorSection,
} from '@/components/workbench/panels';
import { LiveLogTerminal } from '@/components/build/LiveLogTerminal';
import { LayersView } from '@/components/build/LayersView';
import { BuildActions } from '@/components/build/BuildActions';
import { PushTerminal } from '@/components/build/PushTerminal';
import { usePushSession } from '@/store/pushSession';

const DockerfileView = lazy(() =>
    import('@/components/build/DockerfileView').then((m) => ({
        default: m.DockerfileView,
    })),
);

const ACTIVE = ['pending', 'building'];

export function BuildDetailPage() {
    const { id = '', buildId = '' } = useParams();
    const qc = useQueryClient();

    const buildQ = useBuild(id, buildId, { enabled: !!id && !!buildId });
    const build = buildQ.data;
    const stream = useBuildStream(id, buildId, build?.status);
    const numbers = useBuildNumbers(id);
    const numLabel = build
        ? (numbers.label(build.id) ?? shortId(build.id))
        : '';

    // Push session lives in a global store; surface it as a Dock tab while active.
    const pushSession = usePushSession((s) => s.current);
    const hasPushForThis = !!pushSession && pushSession.buildId === buildId;
    const [dockActive, setDockActive] = useState<string>('logs');
    useEffect(() => {
        if (hasPushForThis) setDockActive('push');
    }, [pushSession?.startedAt, hasPushForThis]);

    const status = stream.status ?? build?.status ?? null;
    const active = status != null && ACTIVE.includes(status);

    useWorkbenchTab({
        kind: 'build',
        title: build ? `build ${numLabel}` : 'build',
        status: status ?? undefined,
        id: `/projects/${id}/builds/${buildId}`,
    });

    useEffect(() => {
        if (active) {
            const t = setInterval(
                () => qc.invalidateQueries({ queryKey: qk.build(id, buildId) }),
                5000,
            );
            return () => clearInterval(t);
        }
    }, [active, id, buildId, qc]);
    useEffect(() => {
        if (status && !ACTIVE.includes(status))
            qc.invalidateQueries({ queryKey: qk.build(id, buildId) });
    }, [status, id, buildId, qc]);

    if (buildQ.isLoading && !build)
        return <CenteredSpinner label="loading build…" />;
    if (!build) return <CenteredSpinner label="build not found" />;

    const baseImage =
        (build.build_config?.base_image as string | undefined) ??
        build.dockerfile_content?.match(/^\s*FROM\s+(\S+)/im)?.[1] ??
        '—';

    return (
        <div className="flex h-full flex-col">
            <EditorToolbar
                tabs={
                    <div className="flex overflow-hidden rounded-md border border-line2">
                        <FileTab
                            active
                            icon={<FileCode2 className="h-3.5 w-3.5" />}
                        >
                            Dockerfile
                        </FileTab>
                    </div>
                }
                right={
                    <>
                        <span className="font-mono text-xs font-bold text-text">
                            {numLabel}
                        </span>
                        <span className="font-mono text-2xs text-dim">
                            {shortId(build.id)}
                        </span>
                        <StatusBadge status={status ?? build.status} />
                    </>
                }
            />

            {/* center: the Dockerfile this build used */}
            <div className="min-h-0 flex-1">
                <Suspense
                    fallback={<CenteredSpinner label="loading editor…" />}
                >
                    <DockerfileView content={build.dockerfile_content} />
                </Suspense>
            </div>

            {/* DOCK: logs + layers */}
            <Dock
                defaultTab="logs"
                activeId={dockActive}
                onActiveChange={setDockActive}
                tabs={[
                    {
                        id: 'logs',
                        label: 'Logs',
                        badge: active ? (
                            <StatusDot status="building" />
                        ) : undefined,
                        content: (
                            <LiveLogTerminal
                                embedded
                                logs={stream.logs}
                                status={status}
                                phase={stream.phase}
                                startedAt={build.started_at ?? build.created_at}
                                finishedAt={build.finished_at}
                            />
                        ),
                    },
                    {
                        id: 'layers',
                        label: 'Layers',
                        badge: build.layers?.length || undefined,
                        content: (
                            <div className="h-full overflow-y-auto p-3">
                                <LayersView layers={build.layers} />
                            </div>
                        ),
                    },
                    ...(hasPushForThis
                        ? [
                              {
                                  id: 'push',
                                  label: 'Push',
                                  badge:
                                      pushSession?.phase === 'pushing' ? (
                                          <span className="h-1.5 w-1.5 rounded-full bg-cyan animate-pulse-ring" />
                                      ) : pushSession?.phase === 'error' ? (
                                          <span className="h-1.5 w-1.5 rounded-full bg-fail" />
                                      ) : (
                                          <span className="h-1.5 w-1.5 rounded-full bg-ok" />
                                      ),
                                  content: <PushTerminal buildId={buildId} />,
                              },
                          ]
                        : []),
                ]}
                headerRight={
                    <span className="font-mono text-2xs text-cyan">
                        ⏱{' '}
                        {formatElapsed(
                            build.started_at ?? build.created_at,
                            active ? null : build.finished_at,
                        )}
                    </span>
                }
            />

            {/* INSPECTOR: stats + image actions */}
            <Inspector>
                <InspectorSection title={`Build ${numLabel}`}>
                    <dl className="space-y-1.5 text-sm">
                        <Stat
                            k="Status"
                            v={<StatusBadge status={status ?? build.status} />}
                        />
                        <Stat
                            k="Duration"
                            v={formatDuration(build.duration_seconds)}
                            mono
                        />
                        <Stat k="Trigger" v={build.trigger_type} mono />
                        <Stat
                            k="Cache"
                            v={build.no_cache ? 'disabled' : 'enabled'}
                            mono
                        />
                        <Stat
                            k="Size"
                            v={
                                build.image_size_human ??
                                formatBytes(build.image_size_bytes)
                            }
                            mono
                        />
                        <Stat
                            k="Layers"
                            v={build.layers?.length?.toString() ?? '—'}
                            mono
                        />
                        <Stat k="Base" v={baseImage} mono />
                    </dl>
                </InspectorSection>

                <InspectorSection title="Image">
                    {build.status === 'success' ? (
                        build.image_cleaned_at ? (
                            <Banner
                                tone="warning"
                                icon={<Info className="h-4 w-4" />}
                            >
                                Image cleaned up — rebuild to download or push.
                            </Banner>
                        ) : (
                            <Banner
                                tone="success"
                                icon={<Box className="h-4 w-4" />}
                            >
                                Image available.
                            </Banner>
                        )
                    ) : (
                        <p className="text-2xs text-dim">
                            {active
                                ? 'Build in progress…'
                                : 'No image produced.'}
                        </p>
                    )}
                    <div className="mt-3">
                        <BuildActions build={build} projectId={id} />
                    </div>
                </InspectorSection>

                {build.image_tag && (
                    <InspectorSection title="Tag">
                        <code className="block break-all font-mono text-2xs text-muted">
                            {build.image_tag}
                        </code>
                    </InspectorSection>
                )}
            </Inspector>

            {stream.error && (
                <div className="shrink-0 border-t border-line bg-warn/[0.06] px-4 py-1.5 font-mono text-2xs text-warn">
                    {stream.error}
                </div>
            )}
        </div>
    );
}

function Stat({
    k,
    v,
    mono,
}: {
    k: string;
    v: React.ReactNode;
    mono?: boolean;
}) {
    return (
        <div className="flex items-center justify-between gap-2">
            <dt className="text-muted">{k}</dt>
            <dd className={mono ? 'truncate font-mono text-xs' : ''}>{v}</dd>
        </div>
    );
}
