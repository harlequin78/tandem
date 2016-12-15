import path =  require("path");
import sm = require("source-map");
import parse5 = require("parse5");

import {
  Dependency,
  IDependencyLoader,
  IDependencyContent,
  BaseDependencyLoader,
  DefaultDependencyLoader,
  IDependencyLoaderResult,
  DependencyLoaderFactoryProvider,
} from "@tandem/sandbox";

import {
  inject,
  Injector,
  HTML_MIME_TYPE,
  ISourceLocation,
  ISourcePosition,
  InjectorProvider,
} from "@tandem/common";

import {
  getHTMLASTNodeLocation,
  ElementTextContentMimeTypeProvider,
} from "@tandem/synthetic-browser";

const hasProtocol = (value) => !!/\w+:\/\//.test(value);

// TODO - need to add source maps here. Okay for now since line & column numbers stay
// the same even when src & href attributes are manipulated. However, the editor *will* break
// if there's a manipulated href / src attribute that shares the same line with another one.
export class HTMLDependencyLoader extends BaseDependencyLoader {

  @inject(InjectorProvider.ID)
  private _injector: Injector;

  async load(dependency: Dependency, { type, content }): Promise<IDependencyLoaderResult> {

    const self = this;

    const { uri, hash } = dependency;

    const expression = parse5.parse(String(content), { locationInfo: true }) as parse5.AST.Default.Document;
    const imports: string[] = [];
    const dirname = path.dirname(uri);

    const mapAttribute = async (parent: parse5.AST.Default.Element, { name, value }: parse5.AST.Default.Attribute) => {

        // must be white listed here to presetn certain elements such as artboard & anchor tags from loading resources. Even
        // better to have a provider for loadable elements, but that's a little overkill for now.
        if (/^(link|script|img)$/.test(parent.nodeName)) {        
          if (value.substr(0, 2) === "//") {
            value = "http:" + value;
          }

          if (/src|href/.test(name)) {
            value = (await self.strategy.resolve(value, uri)).uri;
            imports.push(value);
          }
        }
        
        return [" ", name, `="`, value,`"`].join("");
    }

    const map = async (expression: parse5.AST.Default.Node): Promise<sm.SourceNode> => {
      const location = getHTMLASTNodeLocation(expression) || { line: 1, column: 1 };
      if (expression.nodeName === "#documentType") {
        return new sm.SourceNode(location.line, location.column, uri, `<!DOCTYPE ${(expression as parse5.AST.Default.DocumentType).name}>`);
      } else if (expression.nodeName === "#comment") {
        return new sm.SourceNode(location.line, location.column, uri, [`<!--${(expression as parse5.AST.Default.CommentNode).data}-->`]);
      } else if (expression.nodeName === "#text") {
        return new sm.SourceNode(location.line, location.column, uri, [(expression as parse5.AST.Default.TextNode).value]);
      } else if (expression.nodeName === "#document" || expression.nodeName === "#document-fragment") {
        return new sm.SourceNode(location.line, location.column, uri, (await Promise.all((expression as parse5.AST.Default.Element).childNodes.map(map))));
      }

      const elementExpression = expression as parse5.AST.Default.Element;

      const { nodeName, attrs, childNodes } = elementExpression;

      const buffer: (string | sm.SourceNode)[] | string | sm.SourceNode = [
        `<` + nodeName,
        ...(await Promise.all(attrs.map(attrib => mapAttribute(elementExpression, attrib)))),
        `>`
      ];


      const textMimeType = ElementTextContentMimeTypeProvider.lookup(expression, self._injector);
      const textLoaderProvider = textMimeType && DependencyLoaderFactoryProvider.find(textMimeType, self._injector);


      if (textLoaderProvider && elementExpression.childNodes.length) {
        const textLoader = textLoaderProvider.create(self.strategy);

        const firstChild = elementExpression.childNodes[0] as parse5.AST.Default.TextNode;
        const firstChildLocation = getHTMLASTNodeLocation(firstChild);
        const lines = Array.from({ length: firstChildLocation.line - 1 }).map(() => "\n").join("");

        const textResult = await textLoader.load(dependency, { 
          type: textMimeType, 
          content: lines + firstChild.value
        });

        let textContent = textResult.content;

        if (textResult.map) {
          const sourceMappingURL = `data:application/json;base64,${new Buffer(JSON.stringify(textResult.map)).toString("base64")}`;
          textContent += `/*# sourceMappingURL=${sourceMappingURL} */`;
        }

        buffer.push(new sm.SourceNode(firstChildLocation.line, firstChildLocation.column, uri, textContent));

      } else {
        buffer.push(...(await Promise.all(childNodes.map(child => map(child)))));
      }

      buffer.push(`</${nodeName}>`);
      return new sm.SourceNode(location.line, location.column, uri, buffer);
    }

    const sourceNode = await map(expression);

    const result = sourceNode.toStringWithSourceMap();
    
    return {
      content: result.code,
      map: result.map.toJSON(),
      type: HTML_MIME_TYPE,
      importedDependencyUris: imports
    };
  }
}