import { EnvHttpProxyAgent, fetch as undiciFetch } from "undici";

const isEnabledFlag = (value?: string) =>
  ["1", "true", "yes", "on"].includes(value?.trim().toLowerCase() || "");

const getProxyEnvironment = (env: NodeJS.ProcessEnv) => ({
  httpProxy: env.HTTP_PROXY?.trim() || env.http_proxy?.trim(),
  httpsProxy: env.HTTPS_PROXY?.trim() || env.https_proxy?.trim(),
  noProxy: env.NO_PROXY?.trim() || env.no_proxy?.trim(),
});

export const shouldUseDevelopmentProxy = (env: NodeJS.ProcessEnv = process.env) => {
  const { httpProxy, httpsProxy } = getProxyEnvironment(env);

  return (
    env.NODE_ENV === "development" &&
    !isEnabledFlag(env.MARKAI_DISABLE_ENV_PROXY) &&
    Boolean(httpProxy || httpsProxy)
  );
};

let developmentProxyAgent: EnvHttpProxyAgent | undefined;

const getDevelopmentProxyAgent = () => {
  if (!developmentProxyAgent) {
    developmentProxyAgent = new EnvHttpProxyAgent(getProxyEnvironment(process.env));
  }

  return developmentProxyAgent;
};

export const fetchWithDevelopmentProxy = (
  input: string | URL,
  init?: RequestInit,
): Promise<Response> => {
  if (!shouldUseDevelopmentProxy()) return fetch(input, init);

  return undiciFetch(input, {
    ...init,
    dispatcher: getDevelopmentProxyAgent(),
  } as Parameters<typeof undiciFetch>[1]) as unknown as Promise<Response>;
};
