import { useEffect, useState } from "react";
import tauriConf from "../../src-tauri/tauri.conf.json";

export interface VersionCheckResult {
  localVersion: string;
  remoteVersion: string | null;
  isOutdated: boolean;
  error: string | null;
  loading: boolean;
}

const LOCAL_VERSION: string = (tauriConf as any)?.version ?? "0.0.0";

export const useVersionCheck = (): VersionCheckResult => {
  const [result, setResult] = useState<VersionCheckResult>({
    localVersion: LOCAL_VERSION,
    remoteVersion: null,
    isOutdated: false,
    error: null,
    loading: true,
  });

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const response = await fetch(
          "https://raw.githubusercontent.com/vatsim-italy/controller-pack-manager/main/src-tauri/tauri.conf.json"
        );
        
        if (!response.ok) {
          throw new Error(`Failed to fetch remote config: ${response.statusText}`);
        }
        
        const remoteConfig = await response.json();
        const remoteVersion = remoteConfig.version;

        // Compare versions
        const isOutdated = compareVersions(LOCAL_VERSION, remoteVersion) < 0;

        setResult({
          localVersion: LOCAL_VERSION,
          remoteVersion,
          isOutdated,
          error: null,
          loading: false,
        });
      } catch (error) {
        setResult((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Unknown error",
          loading: false,
        }));
      }
    };

    checkVersion();
  }, []);

  return result;
};

/**
 * Compare two semantic version strings
 * Returns: -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
 */
export const compareVersions = (v1: string, v2: string): number => {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    
    if (part1 < part2) return -1;
    if (part1 > part2) return 1;
  }
  
  return 0;
};
