/// <reference types="wxt/vite-builder-env" />
/// <reference types="@wxt-dev/module-react" />

declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

