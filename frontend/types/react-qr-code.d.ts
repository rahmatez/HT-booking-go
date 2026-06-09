declare module "react-qr-code" {
  import type { FC } from "react";

  type QRCodeProps = {
    value: string;
    size?: number;
    level?: "L" | "M" | "Q" | "H";
    bgColor?: string;
    fgColor?: string;
    "aria-label"?: string;
  };

  const QRCode: FC<QRCodeProps>;
  export default QRCode;
}
