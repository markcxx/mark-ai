import type { Processor } from "unified";
import type { Extension as FromMarkdownExtension } from "mdast-util-from-markdown";
import type { Extension, State, Tokenizer } from "micromark-util-types";
import type {} from "mdast-util-math";
import type {} from "remark-parse";

// Recognize LaTeX delimiters before CommonMark consumes their backslashes as
// punctuation escapes. A parser extension naturally leaves code and URLs alone.
declare module "micromark-util-types" {
  interface TokenTypeMap {
    latexDelimitedMath: "latexDelimitedMath";
    latexDisplayMath: "latexDisplayMath";
    latexMathData: "latexMathData";
  }
}

function createTokenizer(display: boolean): Tokenizer {
  return function (effects, ok, nok) {
    const tokenType = display ? "latexDisplayMath" : "latexDelimitedMath";
    let close: number;
    const start: State = (code) => {
      effects.enter(tokenType);
      effects.enter("latexMathData");
      effects.consume(code);
      return opening;
    };
    const opening: State = (code) => {
      if (display ? code !== 91 : code !== 40 && code !== 91) return nok(code);
      close = code === 40 ? 41 : 93;
      effects.consume(code);
      return content;
    };
    const content: State = (code) => {
      if (code === null) return nok(code);
      if (code === -5 || code === -4 || code === -3) {
        effects.exit("latexMathData");
        effects.enter("lineEnding");
        effects.consume(code);
        effects.exit("lineEnding");
        return afterLineEnding;
      }
      effects.consume(code);
      return code === 92 ? afterBackslash : content;
    };
    const afterLineEnding: State = (code) => {
      if (display && this.parser.lazy[this.now().line]) return nok(code);
      if (code === null) return nok(code);
      if (code === -5 || code === -4 || code === -3) {
        effects.enter("lineEnding");
        effects.consume(code);
        effects.exit("lineEnding");
        return afterLineEnding;
      }
      effects.enter("latexMathData");
      return content(code);
    };
    const afterBackslash: State = (code) => {
      if (code === close) {
        effects.consume(code);
        effects.exit("latexMathData");
        effects.exit(tokenType);
        return display ? afterDisplay : ok;
      }
      // Two backslashes are a LaTeX line break, not a closing delimiter.
      if (code === 92) {
        effects.consume(code);
        return content;
      }
      return content(code);
    };
    const afterDisplay: State = (code) => {
      if (code === 32 || code === -2 || code === -1) {
        effects.enter("whitespace");
        effects.consume(code);
        effects.exit("whitespace");
        return afterDisplay;
      }
      return code === null || code === -5 || code === -4 || code === -3 ? ok(code) : nok(code);
    };
    return start;
  };
}

// Flow parsing must claim the whole display block before headings, lists and
// blank lines can split it into separate Markdown blocks.
const syntax: Extension = {
  text: { 92: { name: "latexDelimitedMath", tokenize: createTokenizer(false) } },
  flow: { 92: { name: "latexDisplayMath", tokenize: createTokenizer(true), concrete: true } },
};
const fromMarkdown: FromMarkdownExtension = {
  enter: {
    latexDisplayMath(token) {
      const value = this.sliceSerialize(token).slice(2, -2).trim();
      this.enter(
        {
          type: "math",
          value,
          data: {
            hName: "pre",
            hChildren: [
              {
                type: "element",
                tagName: "code",
                properties: { className: ["language-math", "math-display"] },
                children: [{ type: "text", value }],
              },
            ],
          },
        },
        token,
      );
    },
    latexDelimitedMath(token) {
      const source = this.sliceSerialize(token);
      const value = source.slice(2, -2).trim();
      this.enter(
        {
          type: "inlineMath",
          value,
          data: {
            hName: "code",
            hProperties: {
              className: ["language-math", source[1] === "[" ? "math-display" : "math-inline"],
            },
            hChildren: [{ type: "text", value }],
          },
        },
        token,
      );
    },
  },
  exit: {
    latexDisplayMath(token) {
      this.exit(token);
    },
    latexDelimitedMath(token) {
      this.exit(token);
    },
  },
};

export function remarkLatexDelimiters(this: Processor) {
  const data = this.data();
  (data.micromarkExtensions ||= []).push(syntax);
  (data.fromMarkdownExtensions ||= []).push(fromMarkdown);
}
