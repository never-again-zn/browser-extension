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
  private _isMarking: boolean = false;

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
}

// Initialize marking after DOM is ready
function initializeMarking() {  
  const performMarking = () => {
    const neverAgain = new NeverAgain();
    neverAgain.markAll();
  };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(performMarking, { timeout: 500 });
  } else {
    setTimeout(performMarking, 500);
  }
}

window.addEventListener('load', () => initializeMarking());