// Generated from lib/tools/registry.ts; public tool definitions.
const toolContextData = [
  {
    "id": "word-document",
    "prompt": "The stepwise, editable Word document tool is enabled for this conversation.\nFirst classify the request as CREATE NEW or EDIT EXISTING.\n\nEDIT EXISTING workflow (including follow-ups such as \"make the font green\", \"change the title font\", or \"edit the table\"):\n1. Call word_document_open. Omit selectors to open the most recently updated editable Word document in this conversation, or pass a known documentId/fileId when the user identifies one.\n2. Never call word_document_begin or word_document_append for a style-only edit. The existing content and structure must be preserved.\n3. For document-wide typography, call word_document_restyle once with the narrowest correct scope. Example: \"change the font color to green\" means scope=all-text and color=008000. Do not replace every block individually.\n4. For one existing content block, call word_document_revise using the stable block ID returned by open.\n5. Call word_document_inspect after the edit, then word_document_finalize. This renders a new file version while preserving the editable source for later follow-ups.\nIf word_document_open reports that editable-source storage is not initialized, do not ask the user to re-upload the generated file and do not restart document generation. Explain that database migration 0008 must be applied by the operator; uploading the DOCX cannot restore the missing MarkAI editing source.\n\nCREATE NEW workflow:\n1. Call word_document_begin with a concise outline and exactly one semantic documentType. Do not include body content in this step. Choose contract for agreements, business-proposal for persuasive proposals, formal-report for formal Chinese reports, academic-paper for papers, meeting-minutes for meeting records, official-notice for notices and official correspondence, operations-manual for SOPs and manuals, resume for CVs, product-spec for product/technical specifications, and general-clean only as a true fallback.\nUse an archetype-specific information architecture; never reuse a generic “overview + table + next steps” skeleton across document families. Contract outlines normally cover parties/definitions, subject matter, payment and term, rights and duties, breach, termination, disputes, and signatures. Business proposals normally cover executive summary, current situation, goals, proposed solution, delivery plan, budget/ROI, risks, and next decision. Formal reports normally cover executive summary, background, progress and evidence, issues, analysis, recommendations, and conclusion. Academic papers normally cover abstract/keywords, introduction, related work, methods, results, discussion, conclusion, and references. Meeting minutes normally capture meeting facts, agenda, discussion, decisions, action owners/deadlines, and unresolved items. Official notices normally cover basis/purpose, audience/scope, arrangements, requirements, deadlines, and contact. Operations manuals normally cover scope, roles, prerequisites, numbered procedures, warnings, exception handling, checks, and revision history. Resumes normally cover summary, experience with outcomes, projects, skills, and education. Product specifications normally cover background, goals/non-goals, users/scenarios, requirements, acceptance criteria, data/permissions, risks, and release plan. General-clean should use the lightest structure suitable for the actual information.\n2. Use subtitle and up to eight short metadata items when they materially support the selected opening layout. Examples: contract parties/date; proposal client/version; meeting time/location/attendees; notice issuer/date; resume contact details; product owner/status/version. Do not place ordinary body prose in metadata.\n3. Follow the returned nextAction and make exactly one Word tool call per model turn so every phase is validated before the next begins. Call word_document_append repeatedly, handling exactly one outline section per call. Normally begin the section with a heading block matching its outline level. Keep each batch small and mark complete=true only when that section is finished.\n4. Every family has its own deterministic opening, typography, numbering, page furniture, and table treatment. Do not imitate another family with local formatting. For contract, academic-paper, operations-manual, and product-spec, omit manual numbers from heading text because the renderer supplies family-appropriate heading numbering.\n5. Use semantic block types and family defaults. Never choose raw font, size, color, indentation, spacing, or table geometry merely to make the document look better; the renderer owns those decisions. Add format or runs only when the user explicitly requests a local exception or the content has clear semantic emphasis. Inline size is limited to 8-16pt.\n6. Each block ID must be unique and stable. If written content needs changes, call word_document_revise rather than starting over. It can insert blocks before/after a target or replace one block with multiple blocks, which must be used to add a missing heading or split an overlong block reported by inspection.\n7. After all sections are complete, call word_document_inspect. Resolve missing sections and warnings, then inspect again after every revision.\n8. Call word_document_finalize only when inspection returns canFinalize=true. Never skip inspect or finalize, and never claim that a file exists before finalize succeeds.\nWhen finalize returns editableSourceSaved=false, the DOCX file is still valid and downloadable. Provide its file result normally, but accurately explain that later cross-message editing requires the database migration and one new generation after migration.\nUse the same language as the requested document. Keep headings consistent with the outline and use tables, lists, quotes, notes, page breaks, and sparse inline formatting where they materially improve the document.",
    "functions": [
      {
        "description": "Open an editable Word document previously finalized in this conversation. Omit both selectors to open the most recently updated Word document. Use this before revising or restyling an existing document; do not call begin for an edit request.",
        "name": "word_document_open",
        "parameters": {
          "additionalProperties": false,
          "properties": {
            "documentId": {
              "description": "Optional editable Word document ID returned by an earlier Word tool call.",
              "maxLength": 80,
              "type": "string",
            },
            "fileId": {
              "description": "Optional generated file ID when the user refers to a specific Word file.",
              "maxLength": 256,
              "type": "string",
            },
          },
          "type": "object",
        },
      },
      {
        "description": "Start a stateful Word document job by choosing one formatting preset and planning its outline. This must be the first Word step. Do not include body content yet.",
        "name": "word_document_begin",
        "parameters": {
          "additionalProperties": false,
          "properties": {
            "documentType": {
              "description": "Semantic document family. Choose the closest real-world archetype; use general-clean only when none of the specialized families fits.",
              "enum": [
                "general-clean",
                "contract",
                "business-proposal",
                "formal-report",
                "academic-paper",
                "meeting-minutes",
                "official-notice",
                "operations-manual",
                "resume",
                "product-spec",
              ],
              "type": "string",
            },
            "features": {
              "description": "Optional global Word features. Normally omit so the selected document family supplies appropriate defaults.",
              "items": {
                "enum": ["header", "page-number", "table-of-contents"],
                "type": "string",
              },
              "maxItems": 3,
              "type": "array",
            },
            "filename": {
              "description": "Output filename without a path. The .docx extension is optional.",
              "maxLength": 100,
              "type": "string",
            },
            "metadata": {
              "description": "Optional compact first-page metadata appropriate to the family, such as parties, date, meeting time, author, version, contact, or product status. Do not put body prose here.",
              "items": {
                "additionalProperties": false,
                "properties": {
                  "label": {"maxLength": 40, "type": "string"},
                  "value": {"maxLength": 300, "type": "string"},
                },
                "required": ["label", "value"],
                "type": "object",
              },
              "maxItems": 8,
              "type": "array",
            },
            "outline": {
              "description": "Ordered document outline. Keep it focused; each item is written in a later step.",
              "items": {
                "additionalProperties": false,
                "properties": {
                  "id": {
                    "description": "Short stable ID such as s1 or s2-1.",
                    "maxLength": 40,
                    "type": "string",
                  },
                  "level": {"maximum": 3, "minimum": 1, "type": "integer"},
                  "title": {"maxLength": 160, "type": "string"},
                },
                "required": ["id", "title", "level"],
                "type": "object",
              },
              "maxItems": 8,
              "type": "array",
            },
            "subtitle": {
              "description": "Optional concise subtitle for covers, proposals, manuals, resumes, or product specifications.",
              "maxLength": 300,
              "type": "string",
            },
            "title": {
              "description":
                  "Document title shown at the top of the Word file.",
              "maxLength": 160,
              "type": "string",
            },
          },
          "required": ["title", "documentType", "outline"],
          "type": "object",
        },
      },
      {
        "description": "Append one small batch of semantic blocks to exactly one outline section. Complete sections in outline order. Use global preset styles by default and sparse format overrides only when they add meaning.",
        "name": "word_document_append",
        "parameters": {
          "additionalProperties": false,
          "properties": {
            "blocks": {
              "items": {
                "additionalProperties": false,
                "description": "One semantic document block. Use preset defaults and include format or runs only for intentional exceptions.",
                "properties": {
                  "format": {
                    "additionalProperties": false,
                    "properties": {
                      "alignment": {
                        "enum": ["left", "center", "right", "justified"],
                        "type": "string",
                      },
                      "firstLineIndentChars": {
                        "maximum": 4,
                        "minimum": 0,
                        "type": "number",
                      },
                      "keepNext": {"type": "boolean"},
                      "lineSpacing": {
                        "maximum": 3,
                        "minimum": 1,
                        "type": "number",
                      },
                      "spacingAfter": {
                        "maximum": 72,
                        "minimum": 0,
                        "type": "number",
                      },
                      "spacingBefore": {
                        "maximum": 72,
                        "minimum": 0,
                        "type": "number",
                      },
                    },
                    "type": "object",
                  },
                  "header": {
                    "description": "Whether the first table row is a header.",
                    "type": "boolean",
                  },
                  "id": {
                    "description": "Stable unique block ID used by later revision steps, for example s1-p1.",
                    "maxLength": 60,
                    "type": "string",
                  },
                  "items": {
                    "description": "List item text. Used only by list blocks.",
                    "items": {"maxLength": 2000, "type": "string"},
                    "maxItems": 100,
                    "type": "array",
                  },
                  "level": {
                    "description":
                        "Heading level 1-3 or list nesting level 0-4.",
                    "maximum": 4,
                    "minimum": 0,
                    "type": "integer",
                  },
                  "ordered": {"type": "boolean"},
                  "rows": {
                    "description": "Table cells as rows of strings. Used only by table blocks.",
                    "items": {
                      "items": {"maxLength": 5000, "type": "string"},
                      "maxItems": 20,
                      "type": "array",
                    },
                    "maxItems": 100,
                    "type": "array",
                  },
                  "runs": {
                    "description": "Inline formatted text. Omit when plain text is sufficient.",
                    "items": {
                      "additionalProperties": false,
                      "properties": {
                        "bold": {"type": "boolean"},
                        "color": {
                          "description": "Optional six-digit hex color, for example 2563EB.",
                          "type": "string",
                        },
                        "font": {"maxLength": 80, "type": "string"},
                        "highlight": {
                          "enum": [
                            "yellow",
                            "green",
                            "cyan",
                            "magenta",
                            "red",
                            "lightGray",
                          ],
                          "type": "string",
                        },
                        "italics": {"type": "boolean"},
                        "size": {
                          "description": "Exceptional inline font size in points, only when the user explicitly requests it. Normally omit this to inherit the preset.",
                          "maximum": 16,
                          "minimum": 8,
                          "type": "number",
                        },
                        "strike": {"type": "boolean"},
                        "text": {"maxLength": 10000, "type": "string"},
                        "underline": {"type": "boolean"},
                      },
                      "required": ["text"],
                      "type": "object",
                    },
                    "maxItems": 100,
                    "type": "array",
                  },
                  "style": {
                    "enum": ["body", "caption", "note"],
                    "type": "string",
                  },
                  "text": {"maxLength": 20000, "type": "string"},
                  "type": {
                    "enum": [
                      "heading",
                      "paragraph",
                      "quote",
                      "list",
                      "table",
                      "page-break",
                    ],
                    "type": "string",
                  },
                },
                "required": ["id", "type"],
                "type": "object",
              },
              "maxItems": 40,
              "type": "array",
            },
            "complete": {
              "description": "True when this step completes the section; false when another batch is needed.",
              "type": "boolean",
            },
            "documentId": {"maxLength": 80, "type": "string"},
            "sectionId": {"maxLength": 40, "type": "string"},
          },
          "required": ["documentId", "sectionId", "blocks", "complete"],
          "type": "object",
        },
      },
      {
        "description": "Revise blocks after writing or inspection. Replace one block with one or more blocks, insert blocks before or after a target, or remove a block. Use multi-block replacement to split an overlong paragraph and insertion to add a missing heading.",
        "name": "word_document_revise",
        "parameters": {
          "additionalProperties": false,
          "properties": {
            "action": {
              "enum": ["replace", "remove", "insert-before", "insert-after"],
              "type": "string",
            },
            "blockId": {"maxLength": 60, "type": "string"},
            "blocks": {
              "description": "One or more blocks for replace/insert actions. For backward compatibility, replacement may be used for a single-block replacement.",
              "items": {
                "additionalProperties": false,
                "description": "One semantic document block. Use preset defaults and include format or runs only for intentional exceptions.",
                "properties": {
                  "format": {
                    "additionalProperties": false,
                    "properties": {
                      "alignment": {
                        "enum": ["left", "center", "right", "justified"],
                        "type": "string",
                      },
                      "firstLineIndentChars": {
                        "maximum": 4,
                        "minimum": 0,
                        "type": "number",
                      },
                      "keepNext": {"type": "boolean"},
                      "lineSpacing": {
                        "maximum": 3,
                        "minimum": 1,
                        "type": "number",
                      },
                      "spacingAfter": {
                        "maximum": 72,
                        "minimum": 0,
                        "type": "number",
                      },
                      "spacingBefore": {
                        "maximum": 72,
                        "minimum": 0,
                        "type": "number",
                      },
                    },
                    "type": "object",
                  },
                  "header": {
                    "description": "Whether the first table row is a header.",
                    "type": "boolean",
                  },
                  "id": {
                    "description": "Stable unique block ID used by later revision steps, for example s1-p1.",
                    "maxLength": 60,
                    "type": "string",
                  },
                  "items": {
                    "description": "List item text. Used only by list blocks.",
                    "items": {"maxLength": 2000, "type": "string"},
                    "maxItems": 100,
                    "type": "array",
                  },
                  "level": {
                    "description":
                        "Heading level 1-3 or list nesting level 0-4.",
                    "maximum": 4,
                    "minimum": 0,
                    "type": "integer",
                  },
                  "ordered": {"type": "boolean"},
                  "rows": {
                    "description": "Table cells as rows of strings. Used only by table blocks.",
                    "items": {
                      "items": {"maxLength": 5000, "type": "string"},
                      "maxItems": 20,
                      "type": "array",
                    },
                    "maxItems": 100,
                    "type": "array",
                  },
                  "runs": {
                    "description": "Inline formatted text. Omit when plain text is sufficient.",
                    "items": {
                      "additionalProperties": false,
                      "properties": {
                        "bold": {"type": "boolean"},
                        "color": {
                          "description": "Optional six-digit hex color, for example 2563EB.",
                          "type": "string",
                        },
                        "font": {"maxLength": 80, "type": "string"},
                        "highlight": {
                          "enum": [
                            "yellow",
                            "green",
                            "cyan",
                            "magenta",
                            "red",
                            "lightGray",
                          ],
                          "type": "string",
                        },
                        "italics": {"type": "boolean"},
                        "size": {
                          "description": "Exceptional inline font size in points, only when the user explicitly requests it. Normally omit this to inherit the preset.",
                          "maximum": 16,
                          "minimum": 8,
                          "type": "number",
                        },
                        "strike": {"type": "boolean"},
                        "text": {"maxLength": 10000, "type": "string"},
                        "underline": {"type": "boolean"},
                      },
                      "required": ["text"],
                      "type": "object",
                    },
                    "maxItems": 100,
                    "type": "array",
                  },
                  "style": {
                    "enum": ["body", "caption", "note"],
                    "type": "string",
                  },
                  "text": {"maxLength": 20000, "type": "string"},
                  "type": {
                    "enum": [
                      "heading",
                      "paragraph",
                      "quote",
                      "list",
                      "table",
                      "page-break",
                    ],
                    "type": "string",
                  },
                },
                "required": ["id", "type"],
                "type": "object",
              },
              "maxItems": 12,
              "type": "array",
            },
            "documentId": {"maxLength": 80, "type": "string"},
            "replacement": {
              "additionalProperties": false,
              "description": "One semantic document block. Use preset defaults and include format or runs only for intentional exceptions.",
              "properties": {
                "format": {
                  "additionalProperties": false,
                  "properties": {
                    "alignment": {
                      "enum": ["left", "center", "right", "justified"],
                      "type": "string",
                    },
                    "firstLineIndentChars": {
                      "maximum": 4,
                      "minimum": 0,
                      "type": "number",
                    },
                    "keepNext": {"type": "boolean"},
                    "lineSpacing": {
                      "maximum": 3,
                      "minimum": 1,
                      "type": "number",
                    },
                    "spacingAfter": {
                      "maximum": 72,
                      "minimum": 0,
                      "type": "number",
                    },
                    "spacingBefore": {
                      "maximum": 72,
                      "minimum": 0,
                      "type": "number",
                    },
                  },
                  "type": "object",
                },
                "header": {
                  "description": "Whether the first table row is a header.",
                  "type": "boolean",
                },
                "id": {
                  "description": "Stable unique block ID used by later revision steps, for example s1-p1.",
                  "maxLength": 60,
                  "type": "string",
                },
                "items": {
                  "description": "List item text. Used only by list blocks.",
                  "items": {"maxLength": 2000, "type": "string"},
                  "maxItems": 100,
                  "type": "array",
                },
                "level": {
                  "description": "Heading level 1-3 or list nesting level 0-4.",
                  "maximum": 4,
                  "minimum": 0,
                  "type": "integer",
                },
                "ordered": {"type": "boolean"},
                "rows": {
                  "description": "Table cells as rows of strings. Used only by table blocks.",
                  "items": {
                    "items": {"maxLength": 5000, "type": "string"},
                    "maxItems": 20,
                    "type": "array",
                  },
                  "maxItems": 100,
                  "type": "array",
                },
                "runs": {
                  "description": "Inline formatted text. Omit when plain text is sufficient.",
                  "items": {
                    "additionalProperties": false,
                    "properties": {
                      "bold": {"type": "boolean"},
                      "color": {
                        "description":
                            "Optional six-digit hex color, for example 2563EB.",
                        "type": "string",
                      },
                      "font": {"maxLength": 80, "type": "string"},
                      "highlight": {
                        "enum": [
                          "yellow",
                          "green",
                          "cyan",
                          "magenta",
                          "red",
                          "lightGray",
                        ],
                        "type": "string",
                      },
                      "italics": {"type": "boolean"},
                      "size": {
                        "description": "Exceptional inline font size in points, only when the user explicitly requests it. Normally omit this to inherit the preset.",
                        "maximum": 16,
                        "minimum": 8,
                        "type": "number",
                      },
                      "strike": {"type": "boolean"},
                      "text": {"maxLength": 10000, "type": "string"},
                      "underline": {"type": "boolean"},
                    },
                    "required": ["text"],
                    "type": "object",
                  },
                  "maxItems": 100,
                  "type": "array",
                },
                "style": {
                  "enum": ["body", "caption", "note"],
                  "type": "string",
                },
                "text": {"maxLength": 20000, "type": "string"},
                "type": {
                  "enum": [
                    "heading",
                    "paragraph",
                    "quote",
                    "list",
                    "table",
                    "page-break",
                  ],
                  "type": "string",
                },
              },
              "required": ["id", "type"],
              "type": "object",
            },
          },
          "required": ["documentId", "blockId", "action"],
          "type": "object",
        },
      },
      {
        "description": "Change typography across an existing Word document without resending or regenerating its content blocks. Use all-text for requests such as changing every font color, or a narrower scope for body, headings, title, or tables. Preset defaults change first; explicit block-level formatting remains authoritative.",
        "name": "word_document_restyle",
        "parameters": {
          "additionalProperties": false,
          "properties": {
            "color": {
              "description": "Optional six-digit hex font color, for example 008000 for green.",
              "maxLength": 7,
              "type": "string",
            },
            "documentId": {"maxLength": 80, "type": "string"},
            "font": {
              "description": "Optional font family name. Omit unless the user requests a font change.",
              "maxLength": 80,
              "type": "string",
            },
            "scope": {
              "description": "Typography target. all-text changes title, headings, body, lists, quotes, notes, tables, headers, and footers.",
              "enum": ["all-text", "body", "headings", "title", "tables"],
              "type": "string",
            },
            "size": {
              "description": "Optional font size in points. Use only when explicitly requested; color or font-only changes preserve the polished type scale.",
              "maximum": 32,
              "minimum": 8,
              "type": "number",
            },
          },
          "required": ["documentId", "scope"],
          "type": "object",
        },
      },
      {
        "description": "Inspect the current Word document structure and formatting plan. This step is mandatory after the last append or revision and before finalization. Follow the returned nextAction.",
        "name": "word_document_inspect",
        "parameters": {
          "additionalProperties": false,
          "properties": {
            "documentId": {"maxLength": 80, "type": "string"},
          },
          "required": ["documentId"],
          "type": "object",
        },
      },
      {
        "description": "Render and save the final editable DOCX. Call only after word_document_inspect reports canFinalize=true and no subsequent changes were made.",
        "name": "word_document_finalize",
        "parameters": {
          "additionalProperties": false,
          "properties": {
            "documentId": {"maxLength": 80, "type": "string"},
          },
          "required": ["documentId"],
          "type": "object",
        },
      },
    ],
  },
  {
    "id": "excel-workbook",
    "functions": [
      {
        "description": "Create a downloadable Excel XLSX workbook. Use it when the user asks for a spreadsheet, data table, workbook, checklist, budget, schedule, or any result that should be delivered as an editable Excel file.",
        "name": "create_excel_workbook",
        "parameters": {
          "additionalProperties": false,
          "properties": {
            "filename": {
              "description": "Output filename without a path. The .xlsx extension is optional.",
              "maxLength": 100,
              "type": "string",
            },
            "sheets": {
              "description": "Workbook sheets. The first row should normally contain column headers. Keep the data concise and directly usable.",
              "items": {
                "additionalProperties": false,
                "properties": {
                  "name": {
                    "description": "Worksheet name, at most 31 characters.",
                    "maxLength": 31,
                    "type": "string",
                  },
                  "rows": {
                    "description": "Two-dimensional array of cell values.",
                    "items": {
                      "items": {"type": "string"},
                      "maxItems": 50,
                      "type": "array",
                    },
                    "maxItems": 1000,
                    "type": "array",
                  },
                },
                "required": ["name", "rows"],
                "type": "object",
              },
              "maxItems": 10,
              "type": "array",
            },
          },
          "required": ["sheets"],
          "type": "object",
        },
      },
    ],
  },
  {
    "id": "data-visualization",
    "prompt": "Data visualization skill is enabled for this conversation.\nWhen a chart materially improves the answer, analyze the data first and then output one or more Apache ECharts option objects inside fenced ```echarts code blocks.\n- The block content must be strict JSON: no JavaScript, functions, comments, trailing commas, Markdown, or HTML.\n- Output the ECharts option object directly, not wrapped in another property.\n- Always include a non-empty series array and a concise title.text.\n- Choose any appropriate ECharts chart type. Supported 2D types include line, bar, pie, scatter, effectScatter, radar, heatmap, funnel, gauge, treemap, sunburst, sankey, graph, lines, pictorialBar, themeRiver, custom-free candlestick, and boxplot.\n- ECharts GL is available. When 3D materially improves the result, you may use bar3D, line3D, scatter3D, surface, map3D, lines3D, graphGL, flowGL, globe, geo3D, or grid3D. Include every required 3D coordinate component and keep the configuration strict JSON.\n- Prefer 2D charts for simple comparisons. Use 3D only when the extra spatial dimension communicates real information or the user explicitly requests it.\n- Use clear Chinese labels when the conversation is Chinese. Include tooltip and legend when helpful.\n- Do not hard-code global color palettes or series itemStyle/lineStyle colors unless color carries essential data semantics. The user can select an official ECharts theme in the chart card.\n- Prefer accurate, readable charts over decorative complexity. Aggregate excessive categories or data points before charting.\n- Never invent missing data. Briefly state important conclusions outside the chart block.\nThe application renders these JSON blocks as interactive charts directly in the chat.",
    "functions": [],
  },
  {
    "id": "mermaid-diagram",
    "prompt": "Mermaid diagram skill is enabled for this conversation.\nWhen a diagram materially improves the answer, output valid Mermaid syntax inside a fenced ```mermaid code block.\n- Use flowcharts for processes and relationships, sequence diagrams for interactions, state diagrams for lifecycles, ER diagrams for data models, and Gantt charts for schedules.\n- Keep labels concise and use Chinese labels when the conversation is Chinese.\n- Do not include HTML, click directives, initialization directives, external links, icons, images, or scripts.\n- Prefer one focused diagram over a dense decorative diagram. Split a large diagram when necessary.\n- Briefly explain important conclusions outside the code block.\nThe application renders Mermaid blocks as interactive diagram artifacts.",
    "functions": [],
  },
  {
    "id": "markmap-mindmap",
    "prompt": "Markmap mind map skill is enabled for this conversation.\nWhen a mind map materially improves the answer, output its Markdown outline inside a fenced ```markmap code block.\n- Start with exactly one level-1 heading as the central topic.\n- Use nested headings and bullet lists to express hierarchy, normally no more than 5 levels deep.\n- Keep every node concise and use Chinese labels when the conversation is Chinese.\n- Do not include raw HTML, images, scripts, iframes, or embedded external content.\n- Briefly explain important conclusions outside the code block.\nThe application renders Markmap blocks as interactive mind-map artifacts.",
    "functions": [],
  },
  {
    "id": "calculator",
    "functions": [
      {
        "description": "Safely calculate a mathematical expression. Supports +, -, *, /, %, ^, parentheses, pi, e, and common functions such as sqrt, abs, min, max, pow, sin, cos, tan, log and ln.",
        "name": "calculate_expression",
        "parameters": {
          "additionalProperties": false,
          "properties": {
            "expression": {
              "description": "The expression to calculate.",
              "maxLength": 500,
              "type": "string",
            },
            "precision": {
              "description":
                  "Decimal places in the result, from 0 to 12. Defaults to 10.",
              "maximum": 12,
              "minimum": 0,
              "type": "integer",
            },
          },
          "required": ["expression"],
          "type": "object",
        },
      },
      {
        "description": "Calculate count, sum, mean, median, minimum and maximum for numeric data.",
        "name": "summarize_numbers",
        "parameters": {
          "additionalProperties": false,
          "properties": {
            "numbers": {
              "description": "Numbers to summarize.",
              "items": {"type": "number"},
              "maxItems": 1000,
              "type": "array",
            },
            "precision": {"maximum": 12, "minimum": 0, "type": "integer"},
          },
          "required": ["numbers"],
          "type": "object",
        },
      },
      {
        "description": "Convert a value between compatible units. Supported units: mm, cm, m, km, in, ft, yd, mi, mg, g, kg, oz, lb, ms, s, min, h, day, C, F and K.",
        "name": "convert_units",
        "parameters": {
          "additionalProperties": false,
          "properties": {
            "from": {
              "description": "Source unit symbol.",
              "maxLength": 10,
              "type": "string",
            },
            "precision": {"maximum": 12, "minimum": 0, "type": "integer"},
            "to": {
              "description": "Target unit symbol.",
              "maxLength": 10,
              "type": "string",
            },
            "value": {"description": "Value to convert.", "type": "number"},
          },
          "required": ["value", "from", "to"],
          "type": "object",
        },
      },
    ],
  },
];
