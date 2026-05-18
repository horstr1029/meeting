"use client";

import { useCallback, useState } from "react";

type Language = "english" | "afrikaans";

interface GenerateOptions {
  attendees?: string;
  agenda?: string;
  customPrompt?: string;
}

export function useMinutesStream() {
  const [minutes, setMinutes] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (
    transcript: string,
    language: Language,
    options: GenerateOptions = {}
  ) => {
    setError(null);
    setMinutes("");
    setStreaming(true);

    const { attendees, agenda, customPrompt } = options;

    let prompt: string;

    if (customPrompt) {
      // Use custom prompt verbatim, inject transcript at the end
      prompt = `${customPrompt}\n\nTranscript:\n${transcript}`;
    } else {
      const languageInstruction =
        language === "afrikaans"
          ? `INSTRUKSIES:
1. Die transkripsie kan in Afrikaans, Engels of beide wees.
2. Genereer die finale Notule in AFRIKAANS.
3. Handhaaf 'n professionele toon.`
          : `INSTRUCTIONS:
1. The transcript may be in Afrikaans, English, or both (code-switching).
2. Generate the final Meeting Minutes in ENGLISH.
3. Ensure all Afrikaans terms or decisions are accurately translated.
4. Maintain a professional tone.`;

      const metaLines: string[] = [];
      if (attendees) metaLines.push(`Attendees: ${attendees}`);
      if (agenda) metaLines.push(`Agenda/Notes: ${agenda}`);
      const metaSection = metaLines.length > 0 ? `\n\nMeeting Context:\n${metaLines.join("\n")}` : "";

      prompt = `${languageInstruction}${metaSection}

You are a professional meeting secretary. Analyze the transcript below and produce structured meeting minutes with:
- Meeting summary
- Key discussion points
- Decisions made
- Action items (format each as: **TASK:** [action] | **WHO:** [person] | **PRIORITY:** [high/medium/low])

Transcript:
${transcript}`;
    }

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, stream: true }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            if (json.response) {
              accumulated += json.response;
              setMinutes(accumulated);
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setStreaming(false);
    }
  }, []);

  return { minutes, setMinutes, streaming, error, generate };
}

export function parseActionItems(raw: string) {
  return raw
    .split("\n")
    .filter((l) => l.toLowerCase().includes("task:"))
    .flatMap((line) => {
      const tMatch = line.match(/TASK:\s*([^|*]+)/i);
      const aMatch = line.match(/(?:WHO|ASSIGNEE):\s*([^|*]+)/i);
      const pMatch = line.match(/PRIORITY:\s*(high|medium|low)/i);
      if (!tMatch) return [];
      return [
        {
          text: tMatch[1].trim(),
          assignee: aMatch ? aMatch[1].trim() : "",
          priority: (pMatch?.[1]?.toLowerCase() ?? "medium") as "high" | "medium" | "low",
        },
      ];
    });
}
