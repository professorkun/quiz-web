/**
 * 内联 SVG 图标集（美化方案 4.5）。
 *
 * 约束：
 * - 三档尺寸 16 / 20 / 24，统一 1.75px 线宽、圆角端点、currentColor；
 * - 一律 aria-hidden，语义由相邻文本承担（不进入文本节点，避免破坏文案断言）；
 * - 纯图标按钮由调用方补 aria-label；
 * - 不引第三方图标库，零网络请求。
 */

import type { SVGProps } from "react";

export type IconSize = 16 | 20 | 24;

export interface IconProps {
  readonly size?: IconSize;
  readonly className?: string;
  readonly title?: string;
}

function svgProps(props: IconProps): SVGProps<SVGSVGElement> {
  return {
    viewBox: "0 0 24 24",
    width: props.size ?? 20,
    height: props.size ?? 20,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    focusable: false,
    className: ["icon", props.className].filter(Boolean).join(" "),
  };
}

export function IconBook(props: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(props)}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20" />
      <path d="M8 7h8M8 10.5h5" />
    </svg>
  );
}

export function IconLayers(props: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(props)}>
      <path d="m12 3 8 4.5-8 4.5-8-4.5z" />
      <path d="m4 12 8 4.5 8-4.5" />
      <path d="m4 16.5 8 4.5 8-4.5" />
    </svg>
  );
}

export function IconPencil(props: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(props)}>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z" />
      <path d="m13.5 6.5 3 3" />
    </svg>
  );
}

export function IconExam(props: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(props)}>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
      <path d="m10 14 1.6 1.6L15 12" />
    </svg>
  );
}

export function IconReview(props: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(props)}>
      <path d="M4 10a8 8 0 1 1 2.5 5.8" />
      <path d="M4 5v5h5" />
      <path d="m9.5 12 2.5 2 4-4" />
    </svg>
  );
}

export function IconUser(props: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-3.5 3.6-5 7-5s6.2 1.5 7 5" />
    </svg>
  );
}

export function IconStar(props: IconProps & { readonly filled?: boolean }): React.ReactElement {
  const base = svgProps(props);
  return (
    <svg {...base} fill={props.filled === true ? "currentColor" : "none"}>
      <path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />
    </svg>
  );
}

export function IconCheck(props: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(props)}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function IconClose(props: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(props)}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function IconCheckCircle(props: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.8 2.8L16 9.5" />
    </svg>
  );
}

export function IconXCircle(props: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </svg>
  );
}

export function IconClock(props: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.2 1.9" />
    </svg>
  );
}

export function IconCalendarClock(props: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(props)}>
      <path d="M5 5h14v15H5z" />
      <path d="M8 3v4M16 3v4M5 9h14" />
      <path d="M12 12v3.2l2 1.2" />
    </svg>
  );
}

export function IconSearch(props: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(props)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

export function IconFilter(props: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(props)}>
      <path d="M4 6h16l-6.2 7.2V20l-3.6-2v-4.8z" />
    </svg>
  );
}

export function IconUpload(props: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(props)}>
      <path d="M12 16V4" />
      <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
      <path d="M4 16v3.5h16V16" />
    </svg>
  );
}

export function IconDownload(props: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(props)}>
      <path d="M12 4v12" />
      <path d="m7.5 11.5 4.5 4.5 4.5-4.5" />
      <path d="M4 16v3.5h16V16" />
    </svg>
  );
}

export function IconSync(props: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(props)}>
      <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5" />
      <path d="M20 4v4.5h-4.5" />
      <path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.5" />
      <path d="M4 20v-4.5h4.5" />
    </svg>
  );
}

export function IconInstall(props: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(props)}>
      <rect x="6" y="3" width="12" height="18" rx="2.5" />
      <path d="M10.5 18h3" />
      <path d="M12 7v6" />
      <path d="m9.8 10.8 2.2 2.2 2.2-2.2" />
    </svg>
  );
}

export function IconBack(props: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(props)}>
      <path d="M20 12H4" />
      <path d="m10 6-6 6 6 6" />
    </svg>
  );
}

export function IconMore(props: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(props)}>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconWarning(props: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(props)}>
      <path d="M12 4 3 20h18z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconPlay(props: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(props)}>
      <path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconArrowUp(props: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(props)}>
      <path d="M12 20V4" />
      <path d="m6 10 6-6 6 6" />
    </svg>
  );
}

export function IconSpark(props: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(props)}>
      <path d="M12 3v4M12 17v4M4.5 12h4M15.5 12h4M6.7 6.7l2.8 2.8M14.5 14.5l2.8 2.8M17.3 6.7l-2.8 2.8M9.5 14.5l-2.8 2.8" />
    </svg>
  );
}

/** 空态几何线稿：虚线框 + 放大镜（不使用插画 / 外链） */
export function EmptyArt(): React.ReactElement {
  return (
    <svg
      viewBox="0 0 96 96"
      width="96"
      height="96"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
      className="empty-art"
    >
      <rect x="12" y="18" width="60" height="52" rx="10" strokeDasharray="4 5" />
      <path d="M24 34h28M24 44h20M24 54h24" opacity="0.55" />
      <circle cx="64" cy="62" r="14" fill="#fff" />
      <path d="m74 72 9 9" />
      <path d="M58 62h12M64 56v12" opacity="0.7" />
    </svg>
  );
}
