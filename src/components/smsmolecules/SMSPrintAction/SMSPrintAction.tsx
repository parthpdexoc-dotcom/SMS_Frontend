import React from 'react';
import { SMSButton } from '@/components/smsatoms';

export interface SMSPrintActionProps {
  targetSelector: string;
  documentTitle?: string;
  label?: string;
  disabled?: boolean;
  excludeSelectors?: string[];
}

const STYLE_LOAD_TIMEOUT_MS = 5000;

const isStylesheetReady = (link: HTMLLinkElement): boolean => {
  if (!link.sheet) return false;
  try {
    return link.sheet.cssRules.length > 0;
  } catch {
    // Cross-origin stylesheets may throw; treat loaded sheet as ready.
    return true;
  }
};

export const SMSPrintAction: React.FC<SMSPrintActionProps> = ({
  targetSelector,
  documentTitle = 'Print',
  label = 'Print',
  disabled = false,
  excludeSelectors = [],
}) => {
  const handlePrint = React.useCallback(() => {
    const printElement = document.querySelector(targetSelector) as HTMLElement | null;
    if (!printElement) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    // Use hidden full-viewport iframe so print layout doesn't accidentally trigger narrow-screen CSS.
    iframe.style.width = '100vw';
    iframe.style.height = '100vh';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.zIndex = '-1';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const iframeWindow = iframe.contentWindow;
    if (!iframeWindow) {
      document.body.removeChild(iframe);
      return;
    }

    const doc = iframeWindow.document;
    const baseHref = document.baseURI;

    doc.open();
    doc.write(`<html><head><title>${documentTitle}</title>`);
    doc.write(`<base href="${baseHref}">`);

    const styles = Array.from(
      document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style')
    );
    styles.forEach((node) => {
      doc.write(node.outerHTML);
    });

    const printClone = printElement.cloneNode(true) as HTMLElement;
    excludeSelectors.forEach((selector) => {
      if (!selector) return;
      printClone.querySelectorAll(selector).forEach((node) => node.remove());
    });

    doc.write('</head><body>');
    doc.write(printClone.outerHTML);
    doc.write('</body></html>');
    doc.close();

    const waitForStylesToLoad = () =>
      new Promise<void>((resolve) => {
        const links = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
        if (links.length === 0) {
          resolve();
          return;
        }

        const finish = () => resolve();

        const pollReady = () => {
          if (links.every(isStylesheetReady)) {
            finish();
            return true;
          }
          return false;
        };

        if (pollReady()) return;

        let pending = links.length;
        const done = () => {
          pending -= 1;
          if (pending <= 0 && pollReady()) {
            finish();
          }
        };

        links.forEach((link) => {
          if (isStylesheetReady(link)) {
            done();
            return;
          }
          link.addEventListener(
            'load',
            () => {
              done();
              pollReady();
            },
            { once: true }
          );
          link.addEventListener('error', done, { once: true });
        });

        const interval = window.setInterval(() => {
          if (pollReady()) {
            window.clearInterval(interval);
          }
        }, 50);

        window.setTimeout(() => {
          window.clearInterval(interval);
          finish();
        }, STYLE_LOAD_TIMEOUT_MS);
      });

    const waitForFontsToLoad = () => {
      if ('fonts' in doc && doc.fonts?.ready) {
        return doc.fonts.ready.catch(() => undefined);
      }
      return Promise.resolve();
    };

    const doPrint = () => {
      iframeWindow.focus();
      iframeWindow.print();
    };

    const cleanup = () => {
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
    };

    iframeWindow.addEventListener('afterprint', cleanup, { once: true });

    Promise.all([waitForStylesToLoad(), waitForFontsToLoad()]).finally(() => {
      iframeWindow.requestAnimationFrame(() => {
        iframeWindow.requestAnimationFrame(() => {
          doPrint();
          setTimeout(cleanup, 2000);
        });
      });
    });
  }, [documentTitle, excludeSelectors, targetSelector]);

  return (
    <SMSButton variant="outlined" onClick={handlePrint} disabled={disabled}>
      {label}
    </SMSButton>
  );
};
