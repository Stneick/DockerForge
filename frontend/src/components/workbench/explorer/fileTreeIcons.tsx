import {
  File,
  FileCode,
  FileJson,
  FileText,
  Database,
  Settings,
  Terminal,
  Lock,
  Folder,
} from 'lucide-react';

/** Extension → icon (Unistream `getFileIcon` pattern, DockerForge tokens). */
export function getFileIcon(name: string, className = 'size-4 shrink-0 text-cyan') {
  const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() : '';
  const cls = className;
  switch (ext) {
    case 'json':
      return <FileJson className={cls} strokeWidth={1.5} />;
    case 'yml':
    case 'yaml':
    case 'toml':
    case 'ini':
    case 'cfg':
    case 'conf':
      return <Settings className={cls} strokeWidth={1.5} />;
    case 'py':
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
      return <FileCode className={cls} strokeWidth={1.5} />;
    case 'sql':
      return <Database className={cls} strokeWidth={1.5} />;
    case 'sh':
    case 'bash':
    case 'zsh':
      return <Terminal className={cls} strokeWidth={1.5} />;
    case 'md':
    case 'txt':
    case 'log':
      return <FileText className={cls} strokeWidth={1.5} />;
    case 'env':
      return <Lock className={cls} strokeWidth={1.5} />;
    default:
      return <File className={cls} strokeWidth={1.5} />;
  }
}

export function getFolderIcon(className = 'size-4 shrink-0 text-docker') {
  return <Folder className={className} strokeWidth={1.5} fill="currentColor" />;
}
