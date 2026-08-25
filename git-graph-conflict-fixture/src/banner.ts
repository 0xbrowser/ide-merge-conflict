export interface BannerOptions {
  userName: string;
  region: string;
}

export function getBanner(options: BannerOptions) {
  return options.userName;
}

export function audit(event: string) {
  return `audit:${event}`;
}
