export function canChangeUploadDialog(open: boolean, uploading: boolean) {
  return open || !uploading;
}
export function canChangeUploadTab(
  current: string,
  next: string,
  uploading: boolean,
) {
  return !uploading || current === next;
}
