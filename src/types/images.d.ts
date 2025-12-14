// Info: (20251214 - AI) Matching Next.js StaticImageData
interface IStaticImageData {
  src: string;
  height: number;
  width: number;
  blurDataURL?: string;
}

declare module '*.png' {
  const value: IStaticImageData;
  export = value;
}

declare module '*.jpg' {
  const value: IStaticImageData;
  export = value;
}

declare module '*.svg' {
  const value: IStaticImageData;
  export = value;
}
