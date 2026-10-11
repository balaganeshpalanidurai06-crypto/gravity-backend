// =====================================================
// GRAVITY RESPONSE FORMATTER v7
// Gemini DOM + Markdown -> Stable UI Blocks
//
// IMPORTANT:
// - This file is intentionally ESM.
// - geminiWeb.js loads it using dynamic import().
// - Do NOT convert export statements to module.exports.
// =====================================================


// =====================================================
// BASIC CLEANING
// =====================================================

function clean(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}


function cleanInline(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}


// =====================================================
// NORMALIZE BLOCK
// =====================================================

function normalizeBlock(block) {
  if (!block) {
    return null;
  }

  const type =
    String(
      block.type || "paragraph"
    ).toLowerCase();


  // ---------------------------------------------------
  // PARAGRAPH
  // ---------------------------------------------------

  if (
    [
      "paragraph",
      "text",
      "plain"
    ].includes(type)
  ) {
    const text =
      clean(
        block.text ??
        block.content
      );

    return text
      ? {
          type: "paragraph",
          text
        }
      : null;
  }


  // ---------------------------------------------------
  // HEADING
  // ---------------------------------------------------

  if (
    [
      "heading",
      "title"
    ].includes(type)
  ) {
    const text =
      clean(
        block.text ??
        block.content
      );

    return text
      ? {
          type: "heading",
          level: Math.min(
            Math.max(
              Number(block.level) || 2,
              1
            ),
            6
          ),
          text
        }
      : null;
  }


  // ---------------------------------------------------
  // QUOTE
  // ---------------------------------------------------

  if (
    type === "quote"
  ) {
    const text =
      clean(
        block.text ??
        block.content
      );

    return text
      ? {
          type: "quote",
          text
        }
      : null;
  }


  // ---------------------------------------------------
  // CODE
  // ---------------------------------------------------

  if (
    [
      "code",
      "code-block"
    ].includes(type)
  ) {
    const text =
      String(
        block.text ??
        block.code ??
        ""
      )
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .trim();

    return text
      ? {
          type: "code",
          language:
            cleanInline(
              block.language ||
              block.lang ||
              ""
            ),
          text
        }
      : null;
  }


  // ---------------------------------------------------
  // UNORDERED LIST
  // ---------------------------------------------------

  if (
    [
      "unordered-list",
      "bullet-list",
      "list"
    ].includes(type)
  ) {
    const items =
      Array.isArray(
        block.items
      )
        ? block.items
            .map(
              (item) =>
                clean(
                  typeof item ===
                    "string"
                    ? item
                    : item?.text ??
                      item?.content ??
                      ""
                )
            )
            .filter(Boolean)
        : [];

    return items.length
      ? {
          type:
            "unordered-list",
          items
        }
      : null;
  }


  // ---------------------------------------------------
  // ORDERED LIST
  // ---------------------------------------------------

  if (
    type ===
    "ordered-list"
  ) {
    const items =
      Array.isArray(
        block.items
      )
        ? block.items
            .map(
              (item) =>
                clean(
                  typeof item ===
                    "string"
                    ? item
                    : item?.text ??
                      item?.content ??
                      ""
                )
            )
            .filter(Boolean)
        : [];

    return items.length
      ? {
          type:
            "ordered-list",
          items
        }
      : null;
  }


  // ---------------------------------------------------
  // TABLE
  // ---------------------------------------------------

  if (
    type === "table"
  ) {
    const rows =
      Array.isArray(
        block.rows
      )
        ? block.rows
            .map(
              (row) =>
                Array.isArray(row)
                  ? row
                      .map(
                        (cell) =>
                          clean(cell)
                      )
                      .filter(Boolean)
                  : []
            )
            .filter(
              (row) =>
                row.length > 0
            )
        : [];

    return rows.length
      ? {
          type: "table",
          rows
        }
      : null;
  }


  // ---------------------------------------------------
  // HORIZONTAL RULE
  // ---------------------------------------------------

  if (
    type === "hr"
  ) {
    return {
      type: "hr"
    };
  }


  return null;
}


// =====================================================
// REMOVE DUPLICATE BLOCKS
// =====================================================

function uniqueBlocks(
  blocks
) {
  const output = [];
  const seen =
    new Set();

  for (
    const raw of
      Array.isArray(blocks)
        ? blocks
        : []
  ) {
    const block =
      normalizeBlock(
        raw
      );

    if (!block) {
      continue;
    }

    const key =
      JSON.stringify(
        block
      );

    if (
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);
    output.push(
      block
    );
  }

  return output;
}


// =====================================================
// MARKDOWN TEXT -> BLOCKS
// =====================================================

function parsePlainTextToBlocks(
  value
) {
  const text =
    String(value ?? "")
      .replace(
        /\r\n/g,
        "\n"
      )
      .replace(
        /\r/g,
        "\n"
      )
      .trim();

  if (!text) {
    return [];
  }

  const lines =
    text.split("\n");

  const result = [];

  let paragraph = [];
  let unordered = [];
  let ordered = [];

  let code = [];
  let language = "";

  let insideCode =
    false;


  const flushParagraph =
    () => {
      const value =
        paragraph
          .join(" ")
          .replace(
            /\s+/g,
            " "
          )
          .trim();

      if (value) {
        result.push({
          type:
            "paragraph",
          text:
            value
        });
      }

      paragraph = [];
    };


  const flushLists =
    () => {
      if (
        unordered.length
      ) {
        result.push({
          type:
            "unordered-list",
          items:
            [...unordered]
        });
      }

      if (
        ordered.length
      ) {
        result.push({
          type:
            "ordered-list",
          items:
            [...ordered]
        });
      }

      unordered = [];
      ordered = [];
    };


  const flushCode =
    () => {
      const value =
        code
          .join("\n")
          .trim();

      if (value) {
        result.push({
          type:
            "code",
          language,
          text:
            value
        });
      }

      code = [];
      language = "";
    };


  for (
    let i = 0;
    i < lines.length;
    i += 1
  ) {
    const raw =
      lines[i];

    const line =
      raw.trim();


    // -------------------------------------------------
    // CODE FENCE
    // -------------------------------------------------

    if (
      line.startsWith(
        "```"
      )
    ) {
      if (
        !insideCode
      ) {
        flushParagraph();
        flushLists();

        insideCode =
          true;

        language =
          line
            .slice(3)
            .trim();
      } else {
        insideCode =
          false;

        flushCode();
      }

      continue;
    }


    if (
      insideCode
    ) {
      code.push(raw);
      continue;
    }


    // -------------------------------------------------
    // EMPTY
    // -------------------------------------------------

    if (!line) {
      flushParagraph();
      flushLists();

      continue;
    }


    // -------------------------------------------------
    // HEADING
    // -------------------------------------------------

    const heading =
      line.match(
        /^(#{1,6})\s+(.+)$/
      );

    if (heading) {
      flushParagraph();
      flushLists();

      result.push({
        type:
          "heading",
        level:
          heading[1].length,
        text:
          heading[2]
      });

      continue;
    }


    // -------------------------------------------------
    // BULLET
    // -------------------------------------------------

    const bullet =
      line.match(
        /^[-*•]\s+(.+)$/
      );

    if (bullet) {
      flushParagraph();

      if (
        ordered.length
      ) {
        flushLists();
      }

      unordered.push(
        bullet[1]
      );

      continue;
    }


    // -------------------------------------------------
    // NUMBER
    // -------------------------------------------------

    const number =
      line.match(
        /^\d+[.)]\s+(.+)$/
      );

    if (number) {
      flushParagraph();

      if (
        unordered.length
      ) {
        flushLists();
      }

      ordered.push(
        number[1]
      );

      continue;
    }


    // -------------------------------------------------
    // QUOTE
    // -------------------------------------------------

    if (
      line.startsWith(
        ">"
      )
    ) {
      flushParagraph();
      flushLists();

      result.push({
        type:
          "quote",
        text:
          line.replace(
            /^>\s?/,
            ""
          )
      });

      continue;
    }


    // -------------------------------------------------
    // HR
    // -------------------------------------------------

    if (
      /^[-*_]{3,}$/.test(
        line
      )
    ) {
      flushParagraph();
      flushLists();

      result.push({
        type:
          "hr"
      });

      continue;
    }


    // -------------------------------------------------
    // NORMAL TEXT
    // -------------------------------------------------

    if (
      unordered.length ||
      ordered.length
    ) {
      flushLists();
    }

    paragraph.push(
      line
    );
  }


  if (
    insideCode
  ) {
    flushCode();
  }

  flushParagraph();
  flushLists();


  return uniqueBlocks(
    result
  );
}


// =====================================================
// GEMINI DOM -> STRUCTURED BLOCKS
// =====================================================

export function extractStructuredContent(
  root
) {
  if (!root) {
    return [];
  }


  // ===================================================
  // EVERYTHING BELOW HERE RUNS INSIDE
  // page.evaluate()
  //
  // Therefore do NOT call external functions here.
  // ===================================================


  const cleanLocal =
    (value) =>
      String(value ?? "")
        .replace(
          /\u00a0/g,
          " "
        )
        .replace(
          /\r\n/g,
          "\n"
        )
        .replace(
          /\r/g,
          "\n"
        )
        .replace(
          /[ \t]+\n/g,
          "\n"
        )
        .replace(
          /\n{3,}/g,
          "\n\n"
        )
        .trim();


  // ===================================================
  // BROWSER-SIDE DEDUPE
  // ===================================================

  const dedupe =
    (items) => {
      const result = [];
      const seen =
        new Set();

      for (
        const item of
          Array.isArray(items)
            ? items
            : []
      ) {
        if (!item) {
          continue;
        }

        const key =
          JSON.stringify(
            item
          );

        if (
          seen.has(key)
        ) {
          continue;
        }

        seen.add(key);
        result.push(
          item
        );
      }

      return result;
    };


  // ===================================================
  // INLINE TEXT
  // ===================================================

  const inlineText =
    (node) => {
      if (!node) {
        return "";
      }


      if (
        node.nodeType ===
        Node.TEXT_NODE
      ) {
        return (
          node.textContent ||
          ""
        );
      }


      if (
        node.nodeType !==
        Node.ELEMENT_NODE
      ) {
        return "";
      }


      const tag =
        node.tagName
          .toLowerCase();


      // UI elements
      if (
        [
          "button",
          "svg",
          "script",
          "style",
          "noscript"
        ].includes(tag)
      ) {
        return "";
      }


      // Line break
      if (
        tag === "br"
      ) {
        return "\n";
      }


      const content =
        Array.from(
          node.childNodes
        )
          .map(
            (child) =>
              inlineText(child)
          )
          .join("");


      // Bold
      if (
        tag === "strong" ||
        tag === "b"
      ) {
        const value =
          content.trim();

        return value
          ? `**${value}**`
          : "";
      }


      // Italic
      if (
        tag === "em" ||
        tag === "i"
      ) {
        const value =
          content.trim();

        return value
          ? `*${value}*`
          : "";
      }


      // Inline code
      if (
        tag === "code" &&
        node.parentElement?.tagName
          .toLowerCase() !==
          "pre"
      ) {
        const value =
          content.trim();

        return value
          ? `\`${value}\``
          : "";
      }


      // Link
      if (
        tag === "a"
      ) {
        const value =
          content.trim();

        const href =
          node.getAttribute(
            "href"
          );

        if (
          value &&
          href
        ) {
          return `[${value}](${href})`;
        }

        return value;
      }


      return content;
    };


  // ===================================================
  // BLOCK TAGS
  // ===================================================

  const blockTags =
    new Set([
      "p",

      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",

      "pre",
      "table",
      "ul",
      "ol",

      "blockquote",
      "hr",

      "code-block",
      "formatted-code-block",
      "g-code-block"
    ]);


  const blocks = [];


  // ===================================================
  // CODE LANGUAGE
  // ===================================================

  const normalizeLanguage =
    (value) => {
      const language =
        cleanLocal(
          value
        ).toLowerCase();

      if (!language) {
        return "";
      }

      const aliases = {
        js:
          "javascript",

        javascript:
          "javascript",

        jsx:
          "jsx",

        ts:
          "typescript",

        typescript:
          "typescript",

        html:
          "html",

        htm:
          "html",

        css:
          "css",

        py:
          "python",

        python:
          "python",

        java:
          "java",

        c:
          "c",

        "c++":
          "cpp",

        cpp:
          "cpp",

        "c#":
          "csharp",

        csharp:
          "csharp",

        sql:
          "sql",

        json:
          "json",

        xml:
          "xml",

        bash:
          "bash",

        sh:
          "bash",

        shell:
          "bash",

        powershell:
          "powershell",

        ps:
          "powershell",

        php:
          "php",

        go:
          "go",

        rust:
          "rust",

        kotlin:
          "kotlin",

        swift:
          "swift"
      };

      return (
        aliases[language] ||
        language
      );
    };


  // ===================================================
  // CODE EXTRACTION
  // ===================================================

  const extractCodeText =
    (codeNode) => {
      if (!codeNode) {
        return "";
      }


      const lines = [];
      let currentLine =
        "";


      const walkCode =
        (node) => {
          if (!node) {
            return;
          }


          if (
            node.nodeType ===
            Node.TEXT_NODE
          ) {
            currentLine +=
              node.textContent ||
              "";

            return;
          }


          if (
            node.nodeType !==
            Node.ELEMENT_NODE
          ) {
            return;
          }


          const tag =
            node.tagName
              .toLowerCase();


          // Gemini code lines
          if (
            tag === "br"
          ) {
            lines.push(
              currentLine
            );

            currentLine =
              "";

            return;
          }


          for (
            const child of
              node.childNodes
          ) {
            walkCode(
              child
            );
          }
        };


      walkCode(
        codeNode
      );


      if (
        currentLine ||
        lines.length === 0
      ) {
        lines.push(
          currentLine
        );
      }


      return lines
        .join("\n")
        .replace(
          /\r\n/g,
          "\n"
        )
        .replace(
          /\r/g,
          "\n"
        )
        .trim();
    };


  // ===================================================
  // FIND LANGUAGE
  // ===================================================

  const getLanguage =
    (node) => {
      if (!node) {
        return "";
      }


      const candidates = [
        node.querySelector(
          ".code-block-decoration > span"
        ),

        node.querySelector(
          ".code-block-decoration span"
        ),

        node.querySelector(
          "[class*='language']"
        ),

        node.querySelector(
          "[data-language]"
        )
      ];


      for (
        const candidate of
          candidates
      ) {
        if (!candidate) {
          continue;
        }


        const value =
          candidate.textContent ||
          candidate.getAttribute(
            "data-language"
          ) ||
          "";


        if (
          cleanLocal(
            value
          )
        ) {
          return normalizeLanguage(
            value
          );
        }
      }


      // Search class names
      const classText =
        String(
          node.className ||
            ""
        );


      const classMatch =
        classText.match(
          /(?:language-|lang-)([a-zA-Z0-9+#-]+)/
        );


      if (
        classMatch
      ) {
        return normalizeLanguage(
          classMatch[1]
        );
      }


      return "";
    };


  // ===================================================
  // DETECT CODE BLOCK
  //
  // Handles:
  //
  // <code-block>
  // <formatted-code-block>
  // <g-code-block>
  //
  // and Gemini div-based code containers.
  // ===================================================

  const isCodeBlock =
    (node) => {
      if (!node) {
        return false;
      }


      const tag =
        node.tagName
          ?.toLowerCase();


      if (
        [
          "code-block",
          "formatted-code-block",
          "g-code-block"
        ].includes(tag)
      ) {
        return true;
      }


      // Direct code/pre
      if (
        tag === "pre"
      ) {
        return true;
      }


      // Gemini code decoration
      if (
        node.querySelector(
          ".code-block-decoration"
        )
      ) {
        const code =
          node.querySelector(
            "code"
          );

        const pre =
          node.querySelector(
            "pre"
          );

        if (
          code ||
          pre
        ) {
          return true;
        }
      }


      // Known Gemini code classes
      const className =
        String(
          node.className ||
            ""
        ).toLowerCase();


      if (
        className.includes(
          "code-block"
        ) &&
        (
          node.querySelector(
            "code"
          ) ||
          node.querySelector(
            "pre"
          )
        )
      ) {
        return true;
      }


      return false;
    };


  // ===================================================
  // EXTRACT CODE BLOCK
  // ===================================================

  const extractCodeBlock =
    (node) => {
      const language =
        getLanguage(
          node
        );


      const codeNode =
        node.querySelector(
          "code.code-container.formatted"
        ) ||
        node.querySelector(
          "code.code-container"
        ) ||
        node.querySelector(
          "pre code"
        ) ||
        node.querySelector(
          "code"
        ) ||
        node.querySelector(
          "pre"
        );


      if (!codeNode) {
        return null;
      }


      const text =
        extractCodeText(
          codeNode
        );


      if (!text) {
        return null;
      }


      return {
        type:
          "code",
        language,
        text
      };
    };


  // ===================================================
  // PARSE TEXT
  // ===================================================

  const parseText =
    (text) => {
      const value =
        String(text ?? "")
          .replace(
            /\r\n/g,
            "\n"
          )
          .replace(
            /\r/g,
            "\n"
          )
          .trim();


      if (!value) {
        return [];
      }


      const lines =
        value.split("\n");

      const result = [];

      let paragraph = [];
      let unordered = [];
      let ordered = [];


      const flushParagraph =
        () => {
          const text =
            paragraph
              .join(" ")
              .replace(
                /\s+/g,
                " "
              )
              .trim();

          if (text) {
            result.push({
              type:
                "paragraph",
              text
            });
          }

          paragraph = [];
        };


      const flushLists =
        () => {
          if (
            unordered.length
          ) {
            result.push({
              type:
                "unordered-list",
              items:
                [
                  ...unordered
                ]
            });
          }


          if (
            ordered.length
          ) {
            result.push({
              type:
                "ordered-list",
              items:
                [
                  ...ordered
                ]
            });
          }


          unordered = [];
          ordered = [];
        };


      for (
        const raw of
          lines
      ) {
        const line =
          raw.trim();


        if (!line) {
          flushParagraph();
          flushLists();

          continue;
        }


        // Heading
        const heading =
          line.match(
            /^(#{1,6})\s+(.+)$/
          );


        if (
          heading
        ) {
          flushParagraph();
          flushLists();

          result.push({
            type:
              "heading",
            level:
              heading[1].length,
            text:
              heading[2]
          });

          continue;
        }


        // Bullet
        const bullet =
          line.match(
            /^[-*•]\s+(.+)$/
          );


        if (
          bullet
        ) {
          flushParagraph();

          if (
            ordered.length
          ) {
            flushLists();
          }

          unordered.push(
            bullet[1]
          );

          continue;
        }


        // Number
        const number =
          line.match(
            /^\d+[.)]\s+(.+)$/
          );


        if (
          number
        ) {
          flushParagraph();

          if (
            unordered.length
          ) {
            flushLists();
          }

          ordered.push(
            number[1]
          );

          continue;
        }


        // Quote
        if (
          line.startsWith(
            ">"
          )
        ) {
          flushParagraph();
          flushLists();

          result.push({
            type:
              "quote",
            text:
              line.replace(
                /^>\s?/,
                ""
              )
          });

          continue;
        }


        // HR
        if (
          /^[-*_]{3,}$/.test(
            line
          )
        ) {
          flushParagraph();
          flushLists();

          result.push({
            type:
              "hr"
          });

          continue;
        }


        if (
          unordered.length ||
          ordered.length
        ) {
          flushLists();
        }


        paragraph.push(
          line
        );
      }


      flushParagraph();
      flushLists();


      return result;
    };


  // ===================================================
  // ADD TEXT
  // ===================================================

  const addText =
    (text) => {
      const value =
        cleanLocal(
          text
        );


      if (!value) {
        return;
      }


      const parsed =
        parseText(
          value
        );


      blocks.push(
        ...parsed
      );
    };


  // ===================================================
  // RECURSIVE DOM WALKER
  //
  // THIS IS THE MAIN v7 FIX.
  //
  // Parent containers are NEVER blindly converted
  // into one paragraph if they contain nested blocks.
  // ===================================================

  const walk =
    (node) => {
      if (
        !node ||
        node.nodeType !==
          Node.ELEMENT_NODE
      ) {
        return;
      }


      const tag =
        node.tagName
          .toLowerCase();


      // ------------------------------------------------
      // IGNORE UI
      // ------------------------------------------------

      if (
        [
          "button",
          "svg",
          "script",
          "style",
          "noscript"
        ].includes(tag)
      ) {
        return;
      }


      // ------------------------------------------------
      // CODE BLOCK
      //
      // MUST COME BEFORE GENERIC DIV HANDLING.
      // ------------------------------------------------

      if (
        isCodeBlock(
          node
        )
      ) {
        const codeBlock =
          extractCodeBlock(
            node
          );


        if (
          codeBlock
        ) {
          blocks.push(
            codeBlock
          );
        }


        return;
      }


      // ------------------------------------------------
      // HEADING
      // ------------------------------------------------

      if (
        /^h[1-6]$/.test(
          tag
        )
      ) {
        const text =
          cleanLocal(
            inlineText(
              node
            )
          );


        if (text) {
          blocks.push({
            type:
              "heading",
            level:
              Number(
                tag.slice(1)
              ),
            text
          });
        }


        return;
      }


      // ------------------------------------------------
      // PARAGRAPH
      // ------------------------------------------------

      if (
        tag === "p"
      ) {
        const text =
          cleanLocal(
            inlineText(
              node
            )
          );


        if (text) {
          blocks.push({
            type:
              "paragraph",
            text
          });
        }


        return;
      }


      // ------------------------------------------------
      // TABLE
      // ------------------------------------------------

      if (
        tag === "table"
      ) {
        const rows = [];


        node
          .querySelectorAll(
            "tr"
          )
          .forEach(
            (tr) => {
              const cells =
                Array.from(
                  tr.querySelectorAll(
                    "th, td"
                  )
                )
                  .map(
                    (cell) =>
                      cleanLocal(
                        cell.innerText ||
                          cell.textContent ||
                          ""
                      )
                  )
                  .filter(Boolean);


              if (
                cells.length
              ) {
                rows.push(
                  cells
                );
              }
            }
          );


        if (
          rows.length
        ) {
          blocks.push({
            type:
              "table",
            rows
          });
        }


        return;
      }


      // ------------------------------------------------
      // UL / OL
      // ------------------------------------------------

      if (
        tag === "ul" ||
        tag === "ol"
      ) {
        const items =
          Array.from(
            node.children ||
              []
          )
            .filter(
              (child) =>
                child.tagName
                  .toLowerCase() ===
                "li"
            )
            .map(
              (li) =>
                cleanLocal(
                  li.innerText ||
                    li.textContent ||
                    ""
                )
            )
            .filter(Boolean);


        if (
          items.length
        ) {
          blocks.push({
            type:
              tag === "ul"
                ? "unordered-list"
                : "ordered-list",
            items
          });
        }


        return;
      }


      // ------------------------------------------------
      // BLOCKQUOTE
      // ------------------------------------------------

      if (
        tag ===
        "blockquote"
      ) {
        const text =
          cleanLocal(
            node.innerText ||
              node.textContent ||
              ""
          );


        if (text) {
          blocks.push({
            type:
              "quote",
            text
          });
        }


        return;
      }


      // ------------------------------------------------
      // HR
      // ------------------------------------------------

      if (
        tag === "hr"
      ) {
        blocks.push({
          type:
            "hr"
        });

        return;
      }


      // ------------------------------------------------
      // GENERIC CONTAINER
      //
      // KEY DIFFERENCE FROM v6:
      // Always recursively inspect descendants when
      // the container contains elements.
      // ------------------------------------------------

      const children =
        Array.from(
          node.children ||
            []
        );


      if (
        children.length
      ) {
        children.forEach(
          (child) =>
            walk(child)
        );


        // IMPORTANT:
        // Do NOT additionally add parent innerText.
        //
        // Otherwise:
        //
        // div
        //  -> p
        //  -> code
        //
        // becomes one giant paragraph.
        //
        return;
      }


      // ------------------------------------------------
      // LEAF TEXT
      // ------------------------------------------------

      const text =
        cleanLocal(
          inlineText(
            node
          )
        );


      if (text) {
        addText(
          text
        );
      }
    };


  // ===================================================
  // START WALK
  // ===================================================

  if (
    root.children &&
    root.children.length
  ) {
    Array.from(
      root.children
    ).forEach(
      (child) =>
        walk(child)
    );
  } else {
    walk(root);
  }


  // ===================================================
  // FINAL DEDUPE
  // ===================================================

  return dedupe(
    blocks
  );
}


// =====================================================
// BLOCKS -> MARKDOWN
// =====================================================

export function blocksToMarkdown(
  blocks
) {
  const normalized =
    uniqueBlocks(
      blocks
    );

  const output = [];


  for (
    const block of
      normalized
  ) {

    // -------------------------------------------------
    // HEADING
    // -------------------------------------------------

    if (
      block.type ===
      "heading"
    ) {
      output.push(
        `${"#".repeat(
          block.level
        )} ${block.text}`
      );
    }


    // -------------------------------------------------
    // PARAGRAPH
    // -------------------------------------------------

    else if (
      block.type ===
      "paragraph"
    ) {
      output.push(
        block.text
      );
    }


    // -------------------------------------------------
    // QUOTE
    // -------------------------------------------------

    else if (
      block.type ===
      "quote"
    ) {
      output.push(
        block.text
          .split("\n")
          .map(
            (line) =>
              `> ${line}`
          )
          .join("\n")
      );
    }


    // -------------------------------------------------
    // CODE
    // -------------------------------------------------

    else if (
      block.type ===
      "code"
    ) {
      output.push(
        "```" +
          (
            block.language ||
            ""
          ) +
          "\n" +
          block.text +
          "\n```"
      );
    }


    // -------------------------------------------------
    // BULLET LIST
    // -------------------------------------------------

    else if (
      block.type ===
      "unordered-list"
    ) {
      output.push(
        block.items
          .map(
            (item) =>
              `- ${item}`
          )
          .join("\n")
      );
    }


    // -------------------------------------------------
    // ORDERED LIST
    // -------------------------------------------------

    else if (
      block.type ===
      "ordered-list"
    ) {
      output.push(
        block.items
          .map(
            (item, index) =>
              `${index + 1}. ${item}`
          )
          .join("\n")
      );
    }


    // -------------------------------------------------
    // TABLE
    // -------------------------------------------------

    else if (
      block.type ===
      "table"
    ) {
      const rows =
        block.rows ||
        [];


      if (
        rows.length
      ) {
        output.push(
          `| ${rows[0].join(
            " | "
          )} |`
        );


        if (
          rows.length > 1
        ) {
          output.push(
            `| ${rows[0]
              .map(
                () => "---"
              )
              .join(
                " | "
              )} |`
          );


          for (
            const row of
              rows.slice(1)
          ) {
            output.push(
              `| ${row.join(
                " | "
              )} |`
            );
          }
        }
      }
    }


    // -------------------------------------------------
    // HR
    // -------------------------------------------------

    else if (
      block.type ===
      "hr"
    ) {
      output.push(
        "---"
      );
    }
  }


  return output
    .filter(Boolean)
    .join("\n\n")
    .replace(
      /\n{3,}/g,
      "\n\n"
    )
    .trim();
}


// =====================================================
// MARKDOWN -> BLOCKS
// =====================================================

export function markdownToBlocks(
  content
) {
  const text =
    String(content ?? "")
      .replace(
        /\r\n/g,
        "\n"
      )
      .replace(
        /\r/g,
        "\n"
      )
      .trim();


  if (!text) {
    return [];
  }


  const lines =
    text.split("\n");

  const result = [];

  let paragraph = [];
  let unordered = [];
  let ordered = [];

  let code = [];
  let language = "";

  let insideCode =
    false;


  // ===================================================
  // FLUSH PARAGRAPH
  // ===================================================

  const flushParagraph =
    () => {
      const value =
        paragraph
          .join(" ")
          .replace(
            /\s+/g,
            " "
          )
          .trim();


      if (value) {
        result.push({
          type:
            "paragraph",
          text:
            value
        });
      }


      paragraph = [];
    };


  // ===================================================
  // FLUSH LISTS
  // ===================================================

  const flushLists =
    () => {
      if (
        unordered.length
      ) {
        result.push({
          type:
            "unordered-list",
          items:
            [
              ...unordered
            ]
        });
      }


      if (
        ordered.length
      ) {
        result.push({
          type:
            "ordered-list",
          items:
            [
              ...ordered
            ]
        });
      }


      unordered = [];
      ordered = [];
    };


  // ===================================================
  // FLUSH CODE
  // ===================================================

  const flushCode =
    () => {
      const value =
        code
          .join("\n")
          .trim();


      if (value) {
        result.push({
          type:
            "code",
          language,
          text:
            value
        });
      }


      code = [];
      language = "";
    };


  // ===================================================
  // TABLE HELPERS
  // ===================================================

  const isTable =
    (line) =>
      line.startsWith("|") &&
      line.endsWith("|") &&
      line.split("|")
        .length >= 3;


  const tableRow =
    (line) =>
      line
        .replace(
          /^\|/,
          ""
        )
        .replace(
          /\|$/,
          ""
        )
        .split("|")
        .map(
          (cell) =>
            cell.trim()
        );


  // ===================================================
  // PARSE
  // ===================================================

  for (
    let i = 0;
    i < lines.length;
    i += 1
  ) {
    const raw =
      lines[i];

    const line =
      raw.trim();


    // -------------------------------------------------
    // CODE FENCE
    // -------------------------------------------------

    if (
      line.startsWith(
        "```"
      )
    ) {
      if (
        !insideCode
      ) {
        flushParagraph();
        flushLists();

        insideCode =
          true;

        language =
          line
            .slice(3)
            .trim();
      } else {
        insideCode =
          false;

        flushCode();
      }

      continue;
    }


    if (
      insideCode
    ) {
      code.push(raw);

      continue;
    }


    // -------------------------------------------------
    // EMPTY
    // -------------------------------------------------

    if (!line) {
      flushParagraph();
      flushLists();

      continue;
    }


    // -------------------------------------------------
    // HEADING
    // -------------------------------------------------

    const heading =
      line.match(
        /^(#{1,6})\s+(.+)$/
      );


    if (
      heading
    ) {
      flushParagraph();
      flushLists();

      result.push({
        type:
          "heading",
        level:
          heading[1].length,
        text:
          heading[2]
      });

      continue;
    }


    // -------------------------------------------------
    // QUOTE
    // -------------------------------------------------

    if (
      line.startsWith(
        ">"
      )
    ) {
      flushParagraph();
      flushLists();

      result.push({
        type:
          "quote",
        text:
          line.replace(
            /^>\s?/,
            ""
          )
      });

      continue;
    }


    // -------------------------------------------------
    // TABLE
    // -------------------------------------------------

    if (
      isTable(line) &&
      i + 1 < lines.length &&
      isTable(
        lines[i + 1]
      )
    ) {
      const separator =
        tableRow(
          lines[i + 1]
        );


      const valid =
        separator.every(
          (cell) =>
            /^:?-{3,}:?$/.test(
              cell.replace(
                /\s/g,
                ""
              )
            )
        );


      if (
        valid
      ) {
        flushParagraph();
        flushLists();


        const rows = [
          tableRow(line)
        ];


        i += 2;


        while (
          i < lines.length &&
          isTable(
            lines[i]
          )
        ) {
          rows.push(
            tableRow(
              lines[i]
            )
          );

          i += 1;
        }


        i -= 1;


        result.push({
          type:
            "table",
          rows
        });


        continue;
      }
    }


    // -------------------------------------------------
    // BULLET
    // -------------------------------------------------

    const bullet =
      line.match(
        /^[-*•]\s+(.+)$/
      );


    if (
      bullet
    ) {
      flushParagraph();


      if (
        ordered.length
      ) {
        flushLists();
      }


      unordered.push(
        bullet[1]
      );


      continue;
    }


    // -------------------------------------------------
    // NUMBER
    // -------------------------------------------------

    const number =
      line.match(
        /^\d+[.)]\s+(.+)$/
      );


    if (
      number
    ) {
      flushParagraph();


      if (
        unordered.length
      ) {
        flushLists();
      }


      ordered.push(
        number[1]
      );


      continue;
    }


    // -------------------------------------------------
    // HR
    // -------------------------------------------------

    if (
      /^[-*_]{3,}$/.test(
        line
      )
    ) {
      flushParagraph();
      flushLists();


      result.push({
        type:
          "hr"
      });


      continue;
    }


    // -------------------------------------------------
    // NORMAL TEXT
    // -------------------------------------------------

    if (
      unordered.length ||
      ordered.length
    ) {
      flushLists();
    }


    paragraph.push(
      line
    );
  }


  // ===================================================
  // FINAL FLUSH
  // ===================================================

  if (
    insideCode
  ) {
    flushCode();
  }


  flushParagraph();
  flushLists();


  return uniqueBlocks(
    result
  );
}