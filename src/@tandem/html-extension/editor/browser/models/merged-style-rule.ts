import { uniq, values, camelCase } from "lodash";
import { SyntheticCSSStyleRule, SyntheticHTMLElement, SyntheticDocument, eachInheritedMatchingStyleRule, isInheritedCSSStyleProperty, SyntheticCSSStyle, SyntheticDOMElement } from "@tandem/synthetic-browser";
import { SyntheticCSSStyleGraphics, SyntheticCSSStyleRuleMutationTypes } from "@tandem/synthetic-browser";
import { MutationEvent, bindable, bubble, Observable, PropertyMutation } from "@tandem/common";
import { CallbackDispatcher, IMessage } from "@tandem/mesh";

export type MatchedCSSStyleRuleType = SyntheticCSSStyleRule|SyntheticHTMLElement;

export class MergedCSSStyleRule extends Observable {

  readonly style: SyntheticCSSStyle;

  @bindable(true)
  @bubble()
  public selectedStyleRule: MatchedCSSStyleRuleType;

  @bindable(true)
  @bubble()
  public selectedStyleProperty: string;
  
  private _allSources:  MatchedCSSStyleRuleType[];
  private _graphics: SyntheticCSSStyleGraphics;
  private _documentObserver: CallbackDispatcher<any, any>;
  private _document: SyntheticDocument;
  private _selectedSourceRule: any;
  

  private _main: {
    [Identifier: string]: MatchedCSSStyleRuleType;
  };

  private _sources: {
    [Identifier: string]: Array<MatchedCSSStyleRuleType>
  };

  constructor(readonly target: SyntheticHTMLElement) {
    super();
    this._selectedSourceRule = {};
    this.style = new SyntheticCSSStyle();
    this._documentObserver = new CallbackDispatcher(this._onDocumentEvent.bind(this));
    this.reset();
  }

  get graphics() {
    if (this._graphics) return this._graphics;
    const graphics = this._graphics = new SyntheticCSSStyleGraphics(this.style);
    graphics.observe({
      dispatch: () => {
        const style = graphics.toStyle();
        for (const propertyName of style) {
          const mainDeclarationSource = this.getSelectedSourceRule(propertyName);
          mainDeclarationSource.style.setProperty(propertyName, style[propertyName]);
        }
      }
    });
    return graphics;
  }

  dispose() {
    if (this._document) {
      this._document.unobserve(this._documentObserver);
    }
  }

  get allSources() {
    return this._allSources;
  }

  get mainSources() {
    return uniq(values(this._main));
  }

  get inheritedRules() {
    return this.mainSources.filter((a, b) => {
      return a !== this.target && !(a as SyntheticCSSStyleRule).matchesElement(this.target);
    });
  }

  get matchingRules() {
    return this.mainSources.filter((a) => {
      return a === this.target || (a as SyntheticCSSStyleRule).matchesElement(this.target);
    });
  }

  setProperty(source: MatchedCSSStyleRuleType, name: string, value: string) {

    if (!this._sources[name]) {
      this._sources[name] = []; 
      
       // TODO - consider priority
       this._main[name] = source;
    }

    if (this._allSources.indexOf(source) === -1) {
      this._allSources.push(source);
   
    }

    this._sources[name].push(source);
  }

  computeStyle() {
    for (let property in this._main) {
      this.style.setProperty(property, this._main[property].style[property]);
    }
  }

  getDeclarationSourceRules(name: string): Array<MatchedCSSStyleRuleType> {
    return this._sources[camelCase(name)] || [];
  }

  getDeclarationMainSourceRule(name: string): MatchedCSSStyleRuleType {
    return this._main[camelCase(name)];
  }

  selectSourceRule(rule: MatchedCSSStyleRuleType, styleName: string) {
    this._selectedSourceRule[styleName] = rule;
    this.notify(new PropertyMutation(PropertyMutation.PROPERTY_CHANGE, this._selectedSourceRule, styleName, rule).toEvent(true));
  }

  getSelectedSourceRule(styleName: string): MatchedCSSStyleRuleType {
    return this._selectedSourceRule[styleName] || this.getDeclarationMainSourceRule(styleName) || this.getBestSourceRule();
  }
 
  getBestSourceRule(): MatchedCSSStyleRuleType {
    return this.mainSources.filter((source) => {
      if (source instanceof SyntheticDOMElement) {
        return true;
      } else if (source instanceof SyntheticCSSStyleRule) {

        // ensure that the source is not an inherited property
        return source.matchesElement(this.target);
      }
    }).sort((a: SyntheticCSSStyleRule, b: SyntheticCSSStyleRule) => {
      if (a === this.target as any) return -1;

      // de-prioritize selectors that match everything
      if (a.selector === "*") return 1;

      // prioritize selectors that match the target ID
      if (a.selector.charAt(0) === "#") return -1;
      return 0; 
    })[0];
  }

  private _onDocumentEvent({ mutation }: MutationEvent<any>) {
    if (!mutation || mutation.type === SyntheticCSSStyleRuleMutationTypes.SET_DECLARATION) return;
    this.reset();
  }

  private reset() {
    if (this._document) {
      this._document.unobserve(this._documentObserver);
    }

    this._document = this.target.ownerDocument;
    this._document.observe(this._documentObserver);

    this._sources    = {};
    this._main       = {};
    this._allSources = [];

    const addStyle = (current: SyntheticHTMLElement, match: MatchedCSSStyleRuleType) => {
      const inherited = current !== this.target;
      for (const property of match.style) {
        if (!inherited || isInheritedCSSStyleProperty(property) && !this.getDeclarationMainSourceRule(property)) {
          this.setProperty(match, property, match.style[property]);
        }
      }
    };

    addStyle(this.target, this.target);
    eachInheritedMatchingStyleRule(this.target, addStyle);
    this.computeStyle();
  }
}