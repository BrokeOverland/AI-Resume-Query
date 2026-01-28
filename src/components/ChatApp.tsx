"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import type {
  ChatMessage,
  ChatResponse,
  JobFitResponse,
  ResumeExperience,
} from "@/lib/types";

type ChatAppProps = {
  experiences: ResumeExperience[];
  suggestedQuestions: string[];
  resumeName: string;
};

type UiMessage = ChatMessage & { id: string };

const FALLBACK_MESSAGE =
  "Sorry — I’m having trouble retrieving that right now. Please try again in a moment.";

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatResumeDate(value: string) {
  if (!value) {
    return "";
  }
  if (value.toLowerCase() === "present") {
    return "Present";
  }
  const [year, month] = value.split("-");
  const monthIndex = Number(month) - 1;
  if (!year || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return value;
  }
  return `${MONTHS[monthIndex]} ${year}`;
}

function formatResumeRange(start: string, end: string) {
  const startLabel = formatResumeDate(start);
  const endLabel = formatResumeDate(end);
  if (!startLabel && !endLabel) {
    return "";
  }
  if (!endLabel) {
    return startLabel;
  }
  if (!startLabel) {
    return endLabel;
  }
  return `${startLabel} - ${endLabel}`;
}

const DEFAULT_VISIBLE_ROLES = 3;

function limitRoles(
  groups: Array<{ company: string; roles: ResumeExperience[] }>,
  maxRoles: number,
) {
  if (maxRoles <= 0) {
    return [];
  }
  let remaining = maxRoles;
  return groups.reduce<Array<{ company: string; roles: ResumeExperience[] }>>(
    (acc, group) => {
      if (remaining <= 0) {
        return acc;
      }
      const roles = group.roles.slice(0, remaining);
      if (roles.length > 0) {
        acc.push({ company: group.company, roles });
        remaining -= roles.length;
      }
      return acc;
    },
    [],
  );
}

type ParsedMarkdownTable = {
  headers: string[];
  rows: string[][];
};

type ParsedJobFitResult = {
  before: string;
  table: ParsedMarkdownTable | null;
  after: string;
};

function parseMarkdownTableRow(row: string) {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparatorRow(row: string) {
  return /^\s*\|?[-:\s|]+\|?\s*$/.test(row);
}

function parseFirstMarkdownTable(lines: string[]): {
  startIndex: number;
  endIndex: number;
  table: ParsedMarkdownTable;
} | null {
  for (let i = 0; i < lines.length - 1; i += 1) {
    const headerLine = lines[i];
    const separatorLine = lines[i + 1];
    if (!headerLine.includes("|") || !separatorLine) {
      continue;
    }
    if (!isSeparatorRow(separatorLine)) {
      continue;
    }
    const headers = parseMarkdownTableRow(headerLine);
    if (headers.length < 2) {
      continue;
    }
    const rows: string[][] = [];
    let j = i + 2;
    while (j < lines.length) {
      const rowLine = lines[j];
      if (!rowLine.includes("|")) {
        break;
      }
      const row = parseMarkdownTableRow(rowLine);
      if (row.every((cell) => !cell)) {
        break;
      }
      rows.push(row);
      j += 1;
    }
    return { startIndex: i, endIndex: j, table: { headers, rows } };
  }
  return null;
}

function parseJobFitResult(result: string): ParsedJobFitResult {
  const lines = result.split(/\r?\n/);
  const tableMatch = parseFirstMarkdownTable(lines);
  if (!tableMatch) {
    return { before: result, table: null, after: "" };
  }
  const before = lines.slice(0, tableMatch.startIndex).join("\n").trimEnd();
  const after = lines.slice(tableMatch.endIndex).join("\n").trimStart();
  return { before, table: tableMatch.table, after };
}

export default function ChatApp({
  experiences,
  suggestedQuestions,
  resumeName,
}: ChatAppProps) {
  const [messages, setMessages] = useState<UiMessage[]>([
    {
      id: makeId(),
      role: "assistant",
      content:
        `Hi! Ask me anything about ${resumeName}'s resume, experience, or skills.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [jobFitResult, setJobFitResult] = useState<string | null>(null);
  const [jobFitError, setJobFitError] = useState<string | null>(null);
  const [jobFitLoading, setJobFitLoading] = useState(false);
  const [expandedBulletId, setExpandedBulletId] = useState<string | null>(null);
  const [showAllRoles, setShowAllRoles] = useState(false);

  const history = useMemo(
    () =>
      messages
        .filter((message) => message.role !== "system")
        .map(({ role, content }) => ({ role, content }))
        .slice(-10),
    [messages],
  );

  async function sendMessage(message: string, bulletId?: string) {
    const trimmed = message.trim();
    if (!trimmed || isLoading) {
      return;
    }

    const nextUserMessage: UiMessage = {
      id: makeId(),
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, nextUserMessage]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history,
          bulletId: bulletId ?? null,
        }),
      });

      const data = (await response.json()) as ChatResponse;
      const content = data.message?.trim() || FALLBACK_MESSAGE;
      setMessages((prev) => [
        ...prev,
        { id: makeId(), role: "assistant", content },
      ]);
    } catch (error) {
      console.error("Chat request failed", error);
      setMessages((prev) => [
        ...prev,
        { id: makeId(), role: "assistant", content: FALLBACK_MESSAGE },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
    setInput("");
  }

  function handleSuggested(question: string) {
    void sendMessage(question);
  }

  async function handleJobFitSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = jobDescription.trim();
    if (!trimmed || jobFitLoading) {
      return;
    }

    setJobFitLoading(true);
    setJobFitError(null);
    setJobFitResult(null);

    try {
      const response = await fetch("/api/job-fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: trimmed }),
      });

      const data = (await response.json()) as JobFitResponse;
      const content = data.message?.trim();
      if (!content) {
        throw new Error("Job fit response missing content");
      }
      setJobFitResult(content);
    } catch (error) {
      console.error("Job fit request failed", error);
      setJobFitError(
        "Sorry — I’m having trouble retrieving that right now. Please try again in a moment.",
      );
    } finally {
      setJobFitLoading(false);
    }
  }

  const groupedExperiences = useMemo(() => {
    const grouped = new Map<string, ResumeExperience[]>();
    experiences.forEach((experience) => {
      const current = grouped.get(experience.company) ?? [];
      current.push(experience);
      grouped.set(experience.company, current);
    });
    return Array.from(grouped, ([company, roles]) => ({ company, roles }));
  }, [experiences]);

  const visibleGroups = useMemo(() => {
    if (showAllRoles) {
      return groupedExperiences;
    }
    return limitRoles(groupedExperiences, DEFAULT_VISIBLE_ROLES);
  }, [groupedExperiences, showAllRoles]);

  const parsedJobFitResult = useMemo(() => {
    if (!jobFitResult) {
      return null;
    }
    return parseJobFitResult(jobFitResult);
  }, [jobFitResult]);

  const jobFitTable = parsedJobFitResult?.table ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/80 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2">
          <h1 className="text-2xl font-semibold">AI Resume Query</h1>
          <p className="text-sm text-slate-300">
            Ask about {resumeName}'s experience and get grounded, concise responses.
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-6">
        <section className="flex h-[420px] flex-col rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "bg-blue-500 text-white"
                      : "bg-slate-800 text-slate-100"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-slate-800 px-4 py-3 text-sm text-slate-200">
                  Typing…
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="border-t border-slate-800 px-6 py-4"
          >
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask about roles, achievements, or skills..."
                className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
                maxLength={1000}
              />
              <button
                type="submit"
                className="rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-400"
                disabled={isLoading}
              >
                Send
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestedQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => handleSuggested(question)}
                  className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-blue-400 hover:text-white"
                >
                  {question}
                </button>
              ))}
            </div>
          </form>
        </section>

        <section className="flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="text-lg font-semibold">Job Fit Analysis</h2>
            <p className="mt-1 text-xs text-slate-400">
              Paste a job description to see honest fit feedback and a skills matrix, based on my job history.
            </p>
            <form onSubmit={handleJobFitSubmit} className="mt-4 space-y-3">
              <textarea
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                placeholder="Paste the full job description here..."
                className="h-40 w-full resize-y rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
                maxLength={6000}
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400"
                  disabled={jobFitLoading}
                >
                  {jobFitLoading ? "Analyzing..." : "Analyze Job Fit"}
                </button>
                <span className="text-xs text-slate-500">
                  {jobDescription.length}/6000
                </span>
              </div>
            </form>
            {jobFitError && (
              <div className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {jobFitError}
              </div>
            )}
            {jobFitResult && (
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-100">
                {parsedJobFitResult?.before && (
                  <div className="whitespace-pre-wrap">
                    {parsedJobFitResult.before}
                  </div>
                )}
                {jobFitTable && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs text-slate-100">
                      <thead className="bg-slate-900/70 text-slate-200">
                        <tr>
                          {jobFitTable.headers.map((header) => (
                            <th
                              key={header}
                              className="border border-slate-800 px-3 py-2 font-semibold"
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {jobFitTable.rows.map((row, rowIndex) => (
                          <tr
                            key={`${rowIndex}-${row.join("-")}`}
                            className={rowIndex % 2 === 0 ? "bg-slate-950/20" : undefined}
                          >
                            {jobFitTable.headers.map((_, colIndex) => (
                              <td
                                key={`${rowIndex}-${colIndex}`}
                                className="border border-slate-800 px-3 py-2 align-top"
                              >
                                {row[colIndex] ?? ""}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {parsedJobFitResult?.after && (
                  <div className="mt-4 whitespace-pre-wrap">
                    {parsedJobFitResult.after}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Resume</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Roles are grouped by employer. Click a bullet to see the story.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAllRoles((prev) => !prev)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-blue-400 hover:text-white"
              >
                {showAllRoles ? "Show fewer roles" : "Show full history"}
              </button>
            </div>
          </div>
          <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
            {visibleGroups.map((group) => (
              <div key={group.company} className="space-y-4">
                <h3 className="text-base font-semibold text-slate-100">
                  {group.company}
                </h3>
                {group.roles.map((role) => (
                  <div key={`${group.company}-${role.role}`} className="space-y-2">
                    <div className="flex flex-wrap items-baseline gap-2 text-sm font-medium text-slate-300">
                      <span>{role.role}</span>
                      <span className="text-xs font-normal text-slate-400">
                        {formatResumeRange(role.start, role.end)}
                      </span>
                    </div>
                    <ul className="space-y-2 text-sm text-slate-200">
                      {role.bullets.map((bullet) => (
                        <li
                          key={bullet.id}
                          className="flex items-start gap-3 pl-3"
                        >
                          <span className="mt-2 inline-block h-1.5 w-1.5 flex-none rounded-full bg-slate-500" />
                          <div className="flex-1">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedBulletId((prev) =>
                                  prev === bullet.id ? null : bullet.id,
                                )
                              }
                              className="text-left underline decoration-slate-500/60 underline-offset-4 transition hover:text-blue-200"
                            >
                              {bullet.text}
                            </button>
                            {expandedBulletId === bullet.id && bullet.story && (
                              <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-300 whitespace-pre-wrap">
                                {bullet.story}
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
