import pkg from "../../package.json";

/** 应用版本（取自 package.json） */
export const APP_VERSION: string = (pkg as { version?: string }).version ?? "0.0.0";
