import { createPopper } from '@popperjs/core';
import Mark from 'mark.js';
import * as namedData from './named_data.json';
import * as names from './names.json';

interface MarkElement {
  elem: HTMLElement;
  popperRef: any;
}

interface NeverAgainListItem {
  [key: string]: {
    data: {
      reason: string;
      proof: string;
    };
  };
}

class NeverAgain {
  private _markInstance: Mark;
  private _listNames: string[] = names;
  private _mutationObserver: MutationObserver | null = null;
  private _markingTimeout: number | null = null;
  private _isMarking: boolean = false;
  private _pendingElements: Set<HTMLElement> = new Set();

  public static data: NeverAgainListItem = namedData;
  public static docBody = document.getElementsByTagName('body')[0];
  public static dataAttrName = 'data-namark';
  public static markedElements: MarkElement[] = [];
  public static markedElementInFocus: null | MarkElement = null;
  public static tooltipElem: HTMLElement;

  constructor() {
    this._markInstance = new Mark(NeverAgain.docBody);
    this._createTooltipElem();
  }

  private _createTooltipElem(): void {
    // Add tooltip element
    NeverAgain.tooltipElem = document.createElement('div');
    NeverAgain.tooltipElem.appendChild(
      document.createTextNode('Boycott Zionism')
    );
    NeverAgain.tooltipElem.classList.add('na-tooltip');
    document.body.appendChild(NeverAgain.tooltipElem);
    const link: HTMLElement = document.createElement('a');
    link.setAttribute('href', 'https://www.boycotzionism.com/');
    link.innerText = 'Boycott Zionism';
    link.classList.add('a-block');
    NeverAgain.tooltipElem.appendChild(link);

    // Add arrow to tooltip element
    const tooltipArrowElem: HTMLElement = document.createElement('div');
    tooltipArrowElem.id = 'na-arrow';
    tooltipArrowElem.setAttribute('data-popper-arrow', '');
    NeverAgain.tooltipElem.appendChild(tooltipArrowElem);
  }

  public markAll(): void {
    if (this._isMarking) return;
    this._isMarking = true;

    const config: Mark.MarkOptions = {
      className: 'na-highlight',
      separateWordSearch: false,
      accuracy: 'exactly',
      diacritics: false,
      caseSensitive: true,
      each: NeverAgain.eachMark,
      done: () => {
        this._isMarking = false;
        NeverAgain.afterMark();
      },
    };
    this._markInstance.mark(this._listNames, config);
  }

  public markChunked(chunkSize: number = 10): void {
    if (this._isMarking) return;
    this._isMarking = true;

    const chunks: string[][] = [];
    for (let i = 0; i < this._listNames.length; i += chunkSize) {
      chunks.push(this._listNames.slice(i, i + chunkSize));
    }

    let currentChunk = 0;
    
    const markNextChunk = () => {
      if (currentChunk >= chunks.length) {
        this._isMarking = false;
        NeverAgain.afterMark();
        return;
      }

      const config: Mark.MarkOptions = {
        className: 'na-highlight',
        separateWordSearch: false,
        accuracy: 'exactly',
        diacritics: false,
        caseSensitive: true,
        each: NeverAgain.eachMark,
        done: () => {
          currentChunk++;
          if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(markNextChunk, { timeout: 1000 });
          } else {
            setTimeout(markNextChunk, 50);
          }
        },
      };
      
      this._markInstance.mark(chunks[currentChunk], config);
    };

    markNextChunk();
  }

  public static updateTooltipLink(name: string | null) {
    if (!name) return;

    const link = NeverAgain.data[name].data.proof;
    const linkText = NeverAgain.data[name].data.reason;
    NeverAgain.tooltipElem.querySelector('a')!.setAttribute('href', link);
    NeverAgain.tooltipElem.querySelector('a')!.textContent = linkText;
  }

  public static eachMark(elem: HTMLElement): void {
    NeverAgain.markedElements.push({ elem: elem, popperRef: null });
  }

  public static afterMark(): void {
    NeverAgain.markedElements.map((mElem) => {
      mElem.elem.addEventListener('mouseenter', () => {
        NeverAgain.create(mElem);
        NeverAgain.markedElementInFocus = mElem;

        const destroy = () => NeverAgain.destroy(mElem);
        mElem.elem.addEventListener('mouseleave', destroy);
        mElem.elem.addEventListener('blur', destroy);

        const mouseEnterListener = () => {
          NeverAgain.markedElementInFocus = mElem;
          NeverAgain.tooltipElem.removeEventListener(
            'mouseleave',
            mouseEnterListener
          );
        };
        NeverAgain.tooltipElem.addEventListener(
          'mouseenter',
          mouseEnterListener
        );
        // TODO: when you hover over links with a marked element, no popup i.e. https://blog.langchain.dev/self-learning-gpts/
        NeverAgain.tooltipElem.addEventListener('focus', mouseEnterListener);
      });
    });

    const ttDestroy = () =>
      NeverAgain.destroy(NeverAgain.markedElementInFocus, true);
    NeverAgain.tooltipElem.addEventListener('mouseleave', ttDestroy);
    NeverAgain.tooltipElem.addEventListener('blur', ttDestroy);
  }

  public static create(elem: MarkElement) {
    NeverAgain.tooltipElem.setAttribute('data-na-show', 'true');
    const name = elem.elem.textContent;
    NeverAgain.updateTooltipLink(name);

    elem.popperRef = createPopper(elem.elem, NeverAgain.tooltipElem, {
      modifiers: [
        {
          name: 'offset',
          options: {
            offset: [0, 8],
          },
        },
      ],
    });
  }

  public static destroy(
    elem: MarkElement | null,
    fromTooltip: boolean = false
  ) {
    if (!elem) {
      return;
    }

    NeverAgain.markedElementInFocus = null;

    if (fromTooltip) {
      NeverAgain.destroyCore(elem);
    } else {
      setTimeout(() => {
        if (!NeverAgain.markedElementInFocus) {
          NeverAgain.destroyCore(elem);
        }
      }, 500);
    }
  }

  public static destroyCore(elem: MarkElement) {
    NeverAgain.tooltipElem.removeAttribute('data-na-show');
    elem.popperRef.destroy();
    elem.popperRef = null;
  }

  public observeDynamicContent(): void {
    // Set up mutation observer for dynamic content
    this._mutationObserver = new MutationObserver((mutations) => {
      // Debounce marking to avoid performance issues
      if (this._markingTimeout) {
        clearTimeout(this._markingTimeout);
      }
      
      // Collect elements that need marking
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this._pendingElements.add(node as HTMLElement);
            }
          });
        }
      });

      this._markingTimeout = window.setTimeout(() => {
        if (this._pendingElements.size > 0 && !this._isMarking) {
          this._pendingElements.forEach(elem => {
            const markInstance = new Mark(elem);
            markInstance.mark(this._listNames, {
              className: 'na-highlight',
              separateWordSearch: false,
              accuracy: 'exactly',
              diacritics: false,
              caseSensitive: true,
              each: NeverAgain.eachMark,
              done: NeverAgain.afterMark,
            });
          });
          this._pendingElements.clear();
        }
      }, 1000); // Increased debounce for heavy sites
    });

    // Start observing
    this._mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: false // Disable character data to improve performance
    });
  }

  public stopObserving(): void {
    if (this._mutationObserver) {
      this._mutationObserver.disconnect();
      this._mutationObserver = null;
    }
    if (this._markingTimeout) {
      clearTimeout(this._markingTimeout);
      this._markingTimeout = null;
    }
    this._pendingElements.clear();
  }
}

// Global instance
let neverAgain: NeverAgain | null = null;

// Site-specific configuration
const getSiteConfig = () => {
  const hostname = window.location.hostname;
  
  // Heavy sites that need extra delay
  const heavySites = [
    'amazon.com',
    'amazon.co.uk',
    'amazon.de',
    'amazon.fr',
    'amazon.es',
    'amazon.it',
    'ebay.com',
    'alibaba.com',
    'walmart.com'
  ];
  
  const isHeavySite = heavySites.some(site => hostname.includes(site));
  
  return {
    initialDelay: isHeavySite ? 3000 : 1000,
    useChunkedMarking: isHeavySite,
    chunkSize: isHeavySite ? 5 : 10,
    enableMutationObserver: !isHeavySite // Disable for heavy sites initially
  };
};

// Initialize marking after DOM is ready
function initializeMarking() {
  const config = getSiteConfig();
  
  const performMarking = () => {
    if (!neverAgain) {
      neverAgain = new NeverAgain();
    }
    
    if (config.useChunkedMarking) {
      neverAgain.markChunked(config.chunkSize);
    } else {
      neverAgain.markAll();
    }
    
    // Enable mutation observer after initial marking if configured
    if (config.enableMutationObserver) {
      setTimeout(() => {
        neverAgain?.observeDynamicContent();
      }, 2000);
    }
  };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(performMarking, { timeout: config.initialDelay });
  } else {
    setTimeout(performMarking, config.initialDelay);
  }
}

// Wait for the right time to initialize
if (document.readyState === 'complete') {
  // Page is fully loaded
  initializeMarking();
} else if (document.readyState === 'interactive' || document.readyState === 'loading') {
  // Wait for window load event for heavy sites
  const config = getSiteConfig();
  if (config.initialDelay >= 3000) {
    window.addEventListener('load', () => {
      setTimeout(initializeMarking, 500);
    });
  } else {
    document.addEventListener('DOMContentLoaded', initializeMarking);
  }
}