// Union type to represent any configurable list (column-based or boolean-based)
import { ListConfig, ControllerListConfig, TitleBarConfig } from "../main";

export type AnyListConfig = ListConfig | { type: "controller"; data: ControllerListConfig } | { type: "title"; data: TitleBarConfig };

export function isListConfig(config: AnyListConfig): config is ListConfig {
    return "columns" in config;
}

export function isControllerListConfig(config: AnyListConfig): config is { type: "controller"; data: ControllerListConfig } {
    return typeof config === "object" && "type" in config && config.type === "controller";
}

export function isTitleBarConfig(config: AnyListConfig): config is { type: "title"; data: TitleBarConfig } {
    return typeof config === "object" && "type" in config && config.type === "title";
}

export function getConfigId(config: AnyListConfig): string {
    if (isListConfig(config)) {
        return config.id;
    }
    if (isControllerListConfig(config)) {
        return "ControllerList";
    }
    if (isTitleBarConfig(config)) {
        return "TitleBar";
    }
    return "Unknown";
}

export function getConfigVisibility(config: AnyListConfig): boolean {
    if (isListConfig(config)) {
        return config.visible;
    }
    if (isControllerListConfig(config)) {
        return config.data.visible;
    }
    if (isTitleBarConfig(config)) {
        return config.data.visible;
    }
    return false;
}

export function getConfigPosition(config: AnyListConfig): { x: number; y: number } {
    if (isListConfig(config)) {
        return { x: config.x, y: config.y };
    }
    if (isControllerListConfig(config)) {
        return { x: config.data.x, y: config.data.y };
    }
    if (isTitleBarConfig(config)) {
        return { x: 0, y: 0 }; // Title bar doesn't have positioning in traditional sense
    }
    return { x: 0, y: 0 };
}

export function setConfigVisibility(config: AnyListConfig, visible: boolean): AnyListConfig {
    if (isListConfig(config)) {
        return { ...config, visible };
    }
    if (isControllerListConfig(config)) {
        return { ...config, data: { ...config.data, visible } };
    }
    if (isTitleBarConfig(config)) {
        return { ...config, data: { ...config.data, visible } };
    }
    return config;
}

export function setConfigPosition(config: AnyListConfig, x: number, y: number): AnyListConfig {
    if (isListConfig(config)) {
        return { ...config, x, y };
    }
    if (isControllerListConfig(config)) {
        return { ...config, data: { ...config.data, x, y } };
    }
    // Title bar doesn't support positioning in traditional sense
    return config;
}
