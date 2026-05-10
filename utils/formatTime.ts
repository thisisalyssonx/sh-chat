export const formatarTempo = (dataStr: string): string => {
  const agora = new Date();
  const data = new Date(dataStr);
  const diff = Math.floor((agora.getTime() - data.getTime()) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
};
