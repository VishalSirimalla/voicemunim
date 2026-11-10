import { useEffect, useRef, useState, type FormEvent } from "react";
import { AudioLines, Check, LoaderCircle, Mic, MicOff, RotateCcw, Send, Square, Volume2, X } from "lucide-react";
import { Card, ErrorNotice, PageHeading } from "../components/common";
import { ApiError, request, requestBlob } from "../services/api";
import type { VoicePreview } from "../types/api";

type VoiceState = "idle" | "recording" | "processing" | "preview";
type ActionPreview = Omit<NonNullable<VoicePreview["preview"]>, "items" | "customer"> & {
  customer?: { name?: string; customerId?: string };
  items?: Array<Record<string, unknown>>;
  totalAmount?: number;
  outstandingAmount?: number;
  amount?: number;
  outstandingAfter?: number;
};

const languages = ["hi-IN", "en-IN", "ta-IN", "te-IN", "kn-IN", "ml-IN", "mr-IN", "pa-IN", "bn-IN", "gu-IN"];
const recordingFormats = [
  { recorderMimeType: "audio/ogg;codecs=opus", fileMimeType: "audio/ogg", extension: "ogg" },
  { recorderMimeType: "audio/mp4", fileMimeType: "audio/mp4", extension: "m4a" },
];

export function VoicePage() {
  const [state, setState] = useState<VoiceState>("idle");
  const [preview, setPreview] = useState<VoicePreview | null>(null);
  const [transcription, setTranscription] = useState("");
  const [languageCode, setLanguageCode] = useState("hi-IN");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | null>(null);
  const chunks = useRef<Blob[]>([]);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const confirming = useRef(false);
  const recordingFlow = useRef(false);
  const transcribing = useRef(false);

  useEffect(() => () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (!audioUrl) return;
    return () => URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const clearAudio = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl("");
  };

  const startRecording = async () => {
    if (recordingFlow.current || busy || state === "preview" || state === "processing") return;
    recordingFlow.current = true;
    setError("");
    setNotice("");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      recordingFlow.current = false;
      setError("Audio recording is not supported in this browser. You can upload an audio file or type a transcript instead.");
      return;
    }
    const format = recordingFormats.find(({ recorderMimeType }) =>
      MediaRecorder.isTypeSupported(recorderMimeType)
    );
    if (!format) {
      recordingFlow.current = false;
      setError("This browser cannot record OGG or MP4 audio supported by the server. Upload an audio file or type a transcript instead.");
      return;
    }
    try {
      const currentStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = currentStream;
      chunks.current = [];
      const mediaRecorder = new MediaRecorder(currentStream, { mimeType: format.recorderMimeType });
      recorder.current = mediaRecorder;
      let recordingFailed = false;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: format.fileMimeType });
        const file = new File([blob], `voice-command.${format.extension}`, {
          type: format.fileMimeType,
        });
        chunks.current = [];
        recorder.current = null;
        currentStream.getTracks().forEach((track) => track.stop());
        stream.current = null;
        if (recordingFailed) return;
        if (timer.current !== null) window.clearInterval(timer.current);
        timer.current = null;
        if (!file.size) {
          recordingFlow.current = false;
          setState("idle");
          setError("No audio was captured. Check your microphone and try recording again.");
          return;
        }
        setRecordedFile(file);
        void transcribeRecording(file);
      };
      mediaRecorder.onerror = () => {
        recordingFailed = true;
        if (timer.current !== null) window.clearInterval(timer.current);
        timer.current = null;
        currentStream.getTracks().forEach((track) => track.stop());
        stream.current = null;
        recorder.current = null;
        chunks.current = [];
        recordingFlow.current = false;
        setState("idle");
        setError("The microphone recording failed. Please try again or upload an audio file.");
      };
      mediaRecorder.start();
      setRecordingTime(0);
      timer.current = window.setInterval(() => setRecordingTime((value) => value + 1), 1000);
      setState("recording");
    } catch (reason) {
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      recorder.current = null;
      chunks.current = [];
      recordingFlow.current = false;
      setState("idle");
      setError(
        reason instanceof Error && ["NotAllowedError", "SecurityError"].includes(reason.name)
          ? "Microphone permission was denied. Allow microphone access or use the transcript box below."
          : reason instanceof Error && reason.name === "NotFoundError"
            ? "No microphone was found. Connect a microphone or use the transcript box below."
            : "Could not start recording. Check microphone access or upload an audio file."
      );
    }
  };

  const stopRecording = () => {
    if (recorder.current?.state !== "recording") return;
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    setState("processing");
    recorder.current.stop();
  };

  const transcribeRecording = async (file: File) => {
    if (transcribing.current) return;
    transcribing.current = true;
    setBusy(true);
    setState("processing");
    setError("");
    try {
      const form = new FormData();
      form.append("audio", file);
      form.append("languageCode", languageCode);
      const result = await request<{ transcript: string }>("/voice/transcribe", {
        method: "POST",
        body: form,
      });
      if (typeof result.transcript !== "string" || !result.transcript.trim()) {
        setError("No speech was detected in the recording. Please speak clearly and try again.");
        return;
      }
      setTranscription(result.transcript);
      setRecordedFile(null);
      if (fileInput.current) fileInput.current.value = "";
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not transcribe the recording. Please try again.");
    } finally {
      transcribing.current = false;
      recordingFlow.current = false;
      setState("idle");
      setBusy(false);
    }
  };

  const processAudio = async (file: File) => {
    setBusy(true);
    setState("processing");
    setError("");
    setNotice("");
    setPreview(null);
    clearAudio();
    try {
      const form = new FormData();
      form.append("audio", file);
      form.append("languageCode", languageCode);
      const result = await request<VoicePreview>("/voice/process", { method: "POST", body: form });
      setPreview(result);
      setTranscription(typeof result.transcript === "string" ? result.transcript : result.transcription?.transcript ?? "");
      setState("preview");
    } catch (reason) {
      setState("idle");
      setError(reason instanceof Error ? reason.message : "Could not process audio.");
    } finally {
      setBusy(false);
    }
  };

  const interpretText = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!transcription.trim()) return;
    setBusy(true);
    setState("processing");
    setError("");
    setNotice("");
    setPreview(null);
    clearAudio();
    try {
      const result = await request<VoicePreview>("/voice/interpret", {
        method: "POST",
        body: { transcription: transcription.trim() },
      });
      setPreview(result);
      setState("preview");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not interpret this transcript.");
      setState("idle");
    } finally {
      setBusy(false);
    }
  };

  const confirmAction = async () => {
    if (!preview?.actionId || confirming.current) return;
    confirming.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const transaction = await request<{ _id: string; type: string; totalAmount?: number }>("/voice/confirm", {
        method: "POST",
        body: { actionId: preview.actionId },
      });
      reset(false);
      setNotice(`Confirmed. ${transaction.type === "SALE" ? "Sale" : "Payment"} recorded successfully.`);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409 && reason.data && typeof reason.data === "object") {
        const refreshed = reason.data as VoicePreview;
        if (refreshed.actionId) {
          setPreview(refreshed);
          setState("preview");
          setError(reason.message);
          return;
        }
      }
      setError(reason instanceof Error ? reason.message : "Could not confirm this action.");
    } finally {
      confirming.current = false;
      setBusy(false);
    }
  };

  const cancelAction = async () => {
    if (!preview?.actionId) {
      reset();
      return;
    }
    setBusy(true);
    setError("");
    try {
      await request("/voice/cancel", { method: "POST", body: { actionId: preview.actionId } });
      setNotice("Pending action cancelled.");
      reset(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not cancel this action.");
    } finally {
      setBusy(false);
    }
  };

  const reset = (clearNotice = true) => {
    setPreview(null);
    setTranscription("");
    setRecordedFile(null);
    setRecordingTime(0);
    setState("idle");
    setError("");
    if (clearNotice) setNotice("");
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    recorder.current = null;
    chunks.current = [];
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (fileInput.current) fileInput.current.value = "";
    clearAudio();
  };

  const actionPreview = (preview?.preview ?? preview) as ActionPreview | null;
  const previewItems = Array.isArray(actionPreview?.items)
    ? actionPreview.items as Array<Record<string, unknown>>
    : [];
  const chooseFile = (file: File | undefined) => {
    if (!file) return;
    setRecordedFile(file);
    setError("");
  };

  return <>
    <PageHeading eyebrow="Voice assistant" title="Talk to your shop" description="Speak naturally, review the interpreted action, and confirm before anything is recorded." />
    {error && <div className="mb-4"><ErrorNotice message={error} /></div>}
    {notice && <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
    <div className="grid items-start gap-5 xl:grid-cols-[1.05fr_0.95fr]">
      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 bg-gradient-to-br from-emerald-50 to-white p-6 sm:p-8">
          <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-semibold text-emerald-900"><AudioLines className="h-4 w-4" /> Voice workspace</span><select value={languageCode} onChange={(event) => setLanguageCode(event.target.value)} className="rounded-lg border border-emerald-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700">{languages.map((language) => <option key={language} value={language}>{language}</option>)}</select></div>
          <div className="flex flex-col items-center py-9 text-center">
            <button onClick={state === "recording" ? stopRecording : () => void startRecording()} disabled={state === "processing" || state === "preview" || busy} className={`grid h-24 w-24 place-items-center rounded-full shadow-lg transition ${state === "recording" ? "animate-pulse bg-rose-600 text-white shadow-rose-200" : "bg-emerald-700 text-white shadow-emerald-200 hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"}`} aria-label={state === "recording" ? "Stop recording" : "Start recording"}>
              {state === "recording" ? <Square className="h-7 w-7 fill-current" /> : <Mic className="h-8 w-8" />}
            </button>
            <p className="mt-5 font-semibold">{state === "recording" ? "Listening…" : state === "processing" ? "Understanding your request…" : state === "preview" ? "Review the action below" : "Tap to speak"}</p>
            <p className="mt-1 text-sm text-slate-500">{state === "recording" ? `${Math.floor(recordingTime / 60).toString().padStart(2, "0")}:${(recordingTime % 60).toString().padStart(2, "0")} · Tap again to stop` : "For example: “Ramesh ko 2 kilo chini de do, udhar mein.”"}</p>
          </div>
          {state === "recording" && <button onClick={stopRecording} className="mx-auto mb-2 flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700"><MicOff className="h-4 w-4" /> Stop recording</button>}
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          <label className="block text-sm font-medium text-slate-700">Or upload a supported audio file<input ref={fileInput} type="file" accept="audio/wav,audio/mpeg,audio/mp3,audio/ogg,audio/flac,audio/aac,audio/mp4,audio/x-m4a" onChange={(event) => chooseFile(event.target.files?.[0])} className="mt-2 block w-full rounded-xl border border-slate-300 p-2 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-emerald-800" /></label>
          {recordedFile && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-sm"><span className="truncate text-slate-700">{recordedFile.name}</span><button onClick={() => void processAudio(recordedFile)} disabled={busy || state === "recording"} className="flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}Process audio</button></div>}
          <form onSubmit={interpretText}>
            <label className="block text-sm font-medium text-slate-700">Or enter a transcript<textarea value={transcription} onChange={(event) => setTranscription(event.target.value)} maxLength={5000} rows={3} placeholder="Type a command in Hindi, Hinglish, or another supported language…" className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 px-3.5 py-3 text-sm outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10" /></label>
            <div className="mt-2 flex justify-between text-xs text-slate-400"><span>Maximum 5,000 characters</span><span>{transcription.length}/5000</span></div>
            <button disabled={!transcription.trim() || busy || state === "recording"} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{busy && !preview ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Interpret transcript</button>
          </form>
        </div>
      </Card>
      <Card className="p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100"><Check className="h-4 w-4 text-slate-600" /></span><div><h2 className="font-semibold">Review before confirming</h2><p className="mt-0.5 text-xs text-slate-500">The assistant never records a transaction automatically.</p></div></div>
        {!preview ? <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-5 text-center"><AudioLines className="mb-3 h-8 w-8 text-slate-400" /><p className="text-sm font-semibold text-slate-700">Your preview will appear here</p><p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">Record or enter a command. Check every detail before confirming a sale or payment.</p></div> :
          <div className="space-y-4">
            {(preview.transcript || preview.transcription?.transcript) && <div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">What we heard</p><p className="mt-2 text-sm leading-6 text-slate-700">{preview.transcript || preview.transcription?.transcript}</p></div>}
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Interpreted action</p>
              <p className="mt-1.5 font-semibold text-slate-900">{String(preview.intent?.intent ?? preview.intent ?? "Business request").replaceAll("_", " ")}</p>
              {preview.clarification && <p className="mt-2 text-sm text-amber-800">{preview.clarification}</p>}
              {actionPreview && <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                {typeof actionPreview.customer?.name === "string" && <p className="text-sm text-slate-600">Customer: <strong className="text-slate-900">{actionPreview.customer.name}</strong></p>}
                {previewItems.map((item, index) => <div key={index} className="flex justify-between gap-3 text-sm"><span>{String(item.productName ?? item.name ?? "Item")} · {String(item.quantity ?? "")} {String(item.unit ?? "")}</span><strong>{typeof item.lineTotal === "number" ? `₹${item.lineTotal.toFixed(2)}` : typeof item.total === "number" ? `₹${item.total.toFixed(2)}` : ""}</strong></div>)}
                {typeof actionPreview.totalAmount === "number" && <div className="flex justify-between border-t border-slate-100 pt-2 font-bold"><span>Total</span><span>₹{actionPreview.totalAmount.toFixed(2)}</span></div>}
                {typeof actionPreview.outstandingAmount === "number" && <div className="flex justify-between text-sm text-slate-600"><span>Outstanding after sale</span><strong>₹{actionPreview.outstandingAmount.toFixed(2)}</strong></div>}
                {typeof actionPreview.amount === "number" && <div className="flex justify-between text-sm"><span>Payment amount</span><strong>₹{actionPreview.amount.toFixed(2)}</strong></div>}
                {typeof actionPreview.outstandingAfter === "number" && <div className="flex justify-between text-sm text-slate-600"><span>Balance after payment</span><strong>₹{actionPreview.outstandingAfter.toFixed(2)}</strong></div>}
              </div>}
              {preview.result !== undefined && <pre className="mt-3 max-h-52 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(preview.result, null, 2)}</pre>}
            </div>
            {preview.requiresConfirmation && preview.actionId && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Please verify the customer, items, quantities, payment, and total. Confirming records the transaction.</div>}
            <div className="flex flex-wrap gap-2">
              {preview.requiresConfirmation && preview.actionId && <button onClick={() => void confirmAction()} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Confirm transaction</button>}
              {preview.requiresConfirmation && preview.actionId && <button onClick={() => void cancelAction()} disabled={busy} className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"><X className="h-4 w-4" />Cancel</button>}
              {!preview.requiresConfirmation && <button onClick={async () => { const text = preview.transcript || preview.clarification || "Here is the result."; try { const audio = await requestBlob("/voice/speak", { text, language: languageCode, container: "mp3" }); clearAudio(); const url = URL.createObjectURL(audio); setAudioUrl(url); await new Audio(url).play(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not play the spoken response."); } }} className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Volume2 className="h-4 w-4" /> Speak response</button>}
              <button onClick={() => reset()} className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RotateCcw className="h-4 w-4" /> New request</button>
            </div>
          </div>}
        {audioUrl && <audio className="mt-4 w-full" controls src={audioUrl} />}
      </Card>
    </div>
  </>;
}
