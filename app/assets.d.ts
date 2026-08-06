declare module "*.svg?raw" {
  const content: string;
  export default content;
}

declare module "*.png?inline" {
  const dataUrl: string;
  export default dataUrl;
}

