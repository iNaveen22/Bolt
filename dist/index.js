import 'dotenv/config';
import express from 'express';
import Groq from 'groq-sdk';
import { getSystemPrompt, BASE_PROMPT } from './prompts.js';
import { basePrompt as nodeBasePrompt } from './defaults/node.js';
import { basePrompt as reactBasePrompt } from './defaults/react.js';
import cors from 'cors';
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const app = express();
const PORT = 3000;
app.use(cors());
app.use(express.json());
app.post("/template", async (req, res) => {
    try {
        const prompt = req.body.prompt;
        async function getGroqChatCompletion() {
            return groq.chat.completions.create({
                messages: [
                    {
                        role: "user",
                        content: "Return either node or react based on what you think this project should be. Only return a single word either 'node' or 'react'. Do not return anything extra",
                    },
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
                model: "openai/gpt-oss-20b",
            });
        }
        const decisionResponse = await getGroqChatCompletion();
        const answer = decisionResponse.choices[0]?.message.content?.trim().toLowerCase();
        console.log("Decision", answer);
        if (answer === "react") {
            return res.json({
                prompts: [BASE_PROMPT, `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${reactBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`],
                uiPrompts: [reactBasePrompt],
            });
        }
        if (answer === "node") {
            return res.json({
                prompts: [`Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${nodeBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`],
                uiPrompts: [nodeBasePrompt],
            });
        }
        return res.status(403).json({ message: "You can't access this." });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Something went wrong" });
    }
});
app.post("/chat", async (req, res) => {
    try {
        const messages = req.body.messages;
        if (!Array.isArray(messages)) {
            return res.status(400).json({ error: "messages must be an array" });
        }
        const system = getSystemPrompt() + `
            Rules:
            - Output ONLY valid XML. No markdown. No explanation.
            - Always end with: <!--END_OF_XML-->
            - If you hit token limits, stop immediately and DO NOT hallucinate missing parts.
            `;
        let convo = [
            {
                role: "system",
                content: system,
            },
            ...messages.map((m) => ({
                role: m.role,
                content: m.content,
            })),
        ];
        let full = "";
        let lastFinish = null;
        for (let i = 0; i < 5; i++) {
            const chatResponse = await groq.chat.completions.create({
                model: "openai/gpt-oss-20b",
                // @ts-ignore
                messages: convo,
                temperature: 0.2,
                max_tokens: 8000,
            });
            const choice = chatResponse.choices[0];
            const chunk = choice?.message.content || "";
            const finish = choice?.finish_reason;
            lastFinish = finish;
            full += chunk;
            if (full.includes("<!--END_OF_XML-->"))
                break;
            if (finish !== "length")
                break;
            convo = [
                ...convo,
                { role: "assistant", content: chunk },
                {
                    role: "user",
                    content: "Continue from EXACTLY where you stopped. Output ONLY the remaining XML. Do not repeat earlier content. End with <!--END_OF_XML-->.",
                },
            ];
        }
        const reply = full.replace("</--END_OF_XML-->", "").trim();
        console.log("finish_reason:", lastFinish);
        console.log("reply length:", reply.length);
        return res.json({ reply, truncated: lastFinish === "length" });
    }
    catch (err) {
        console.error("Chat error:", err);
        return res.status(500).json({ error: "Chat failed" });
    }
});
app.post("/chat/stream", async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    //@ts-ignore
    res.flushHeaders?.();
    const send = (event, data) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    try {
        const messages = req.body.messages;
        if (!Array.isArray(messages)) {
            send("error", { message: "messages must be array" });
            return res.end();
        }
        const formattedMessages = [
            { role: "system", content: getSystemPrompt() },
            ...messages,
        ];
        const stream = await groq.chat.completions.create({
            model: "openai/gpt-oss-20b",
            // @ts-ignore
            messages: formattedMessages,
            temperature: 0.2,
            max_tokens: 8000,
            stream: true,
        });
        for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta?.content ?? "";
            if (delta)
                send("token", { token: delta });
            const finish = chunk.choices?.[0]?.finish_reason;
            if (finish)
                send("finish", { finish_reason: finish });
        }
        send("done", { ok: true });
        res.end();
    }
    catch (e) {
        send("error", { message: e?.message ?? "stream failed" });
        res.end();
    }
});
app.listen(PORT, () => {
    console.log(`server is running on port: ${PORT}`);
});
//# sourceMappingURL=index.js.map