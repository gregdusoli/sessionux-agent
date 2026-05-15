declare module 'qrcode' {
  export interface QrCodeRenderOptions {
    color?: {
      dark?: string;
      light?: string;
    };
    margin?: number;
    type?: 'svg' | 'terminal' | 'utf8';
    width?: number;
  }

  const QRCode: {
    toDataURL(text: string, options?: QrCodeRenderOptions): Promise<string>;
    toString(text: string, options?: QrCodeRenderOptions): Promise<string>;
  };

  export default QRCode;
}
