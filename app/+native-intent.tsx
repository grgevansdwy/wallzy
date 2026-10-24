export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  if (path.includes('reset-password') || path.includes('type=recovery')) {
    return '/reset-password';
  }
  
  if (path.includes('type=signup') || path.includes('type=email') || path.includes('type=magiclink')) {
    return '/sign-in';
  }
  
  if (path.includes('verification')) {
    return '/verification';
  }
  
  return path || '/';
}