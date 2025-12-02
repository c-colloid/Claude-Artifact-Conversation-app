/**
 * Helper utility functions
 */

/**
 * デバウンス関数
 * 連続した呼び出しを遅延させ、最後の呼び出しのみを実行する
 * @param func - 実行する関数
 * @param delay - 遅延時間（ミリ秒）
 * @returns デバウンスされた関数
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: number;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay) as unknown as number;
  };
};

/**
 * スロットル関数
 * 一定時間内に1回のみ関数を実行する
 * @param func - 実行する関数
 * @param limit - 実行間隔（ミリ秒）
 * @returns スロットルされた関数
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * 画像圧縮関数
 * アバター画像を最適化してファイルサイズを削減
 *
 * @param file - 圧縮する画像ファイル
 * @param maxSize - 最大サイズ（ピクセル、デフォルト: 200）
 * @param quality - 圧縮品質（0-1、デフォルト: 0.7）
 * @returns Base64エンコードされた圧縮画像
 *
 * 機能:
 * - アスペクト比を維持したリサイズ
 * - WebP形式でエクスポート（70%品質）
 * - ファイルサイズを60-80%削減
 */
export const compressImage = async (
  file: File,
  maxSize: number = 200,
  quality: number = 0.7
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new window.Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // アスペクト比を維持してリサイズ
        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // WebP形式でエクスポート（ブラウザが対応していない場合はJPEG）
        const mimeType =
          canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0
            ? 'image/webp'
            : 'image/jpeg';

        const compressedDataUrl = canvas.toDataURL(mimeType, quality);
        resolve(compressedDataUrl);
      };

      img.onerror = () => {
        reject(new Error('画像の読み込みに失敗しました'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('ファイルの読み込みに失敗しました'));
    };

    reader.readAsDataURL(file);
  });
};

/**
 * 今日の日付を取得（YYYY-MM-DD形式）
 * @returns YYYY-MM-DD形式の文字列
 */
export const getTodayDate = (): string => {
  return new Date().toISOString().slice(0, 10);
};

/**
 * ファイル名を生成（プレフィックス + 名前 + 日付）
 * @param prefix - ファイル名のプレフィックス
 * @param name - ファイル名に含める名前
 * @returns 生成されたファイル名
 */
export const generateFileName = (prefix: string, name: string): string => {
  return `${prefix}_${name}_${getTodayDate()}.json`;
};
