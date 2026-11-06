"use client";
import type { ReactNode } from "react";
import { ConfigProvider, theme } from "antd";

export default function AntdProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "var(--color-content)",
          colorBgBase: "var(--color-base)",
          colorBgContainer: "var(--color-surface)",
          colorBgElevated: "var(--color-elevated)",
          colorBorder: "var(--color-border)",
          colorBorderSecondary: "var(--color-border)",
          colorText: "var(--color-opposite)",
          colorTextSecondary: "var(--color-content-secondary)",
          colorTextTertiary: "var(--color-content-muted)",
          colorTextDescription: "var(--color-content-muted)",
          colorTextLightSolid: "var(--color-base)",
          colorSuccess: "var(--color-success)",
          colorWarning: "var(--color-warning)",
          colorError: "var(--color-danger)",
          colorInfo: "var(--color-info)",
          borderRadius: 16,
          fontFamily: "inherit",
        },
        components: {
          Table: {
            colorBgContainer: "transparent",
            headerBg: "transparent",
            headerColor: "var(--color-content-muted)",
            headerSplitColor: "transparent",
            headerSortActiveBg: "transparent",
            headerSortHoverBg: "transparent",
            bodySortBg: "transparent",
            rowHoverBg: "var(--color-elevated)",
            borderColor: "var(--color-border)",
            cellPaddingBlock: 8,
            cellPaddingInline: 8,
          },
          Segmented: {
            trackBg: "var(--color-elevated)",
            trackPadding: 3,
            itemColor: "var(--color-content-muted)",
            itemHoverColor: "var(--color-opposite)",
            itemHoverBg: "transparent",
            itemSelectedBg: "var(--color-content)",
            itemSelectedColor: "var(--color-base)",
            borderRadius: 999,
            borderRadiusSM: 999,
            borderRadiusLG: 999,
          },
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}