
import { useState } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  CheckCircle2,
  XCircle,
  Sparkles,
  AudioLines,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";

export default function VoiceAssistant() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [transaction, setTransaction] = useState(null);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const loadDemo = () => {
    setTranscript(
      "Ramesh ko 2 kilo chini aur ek Tata Salt de do. Udhar mein likh dena."
    );

    setTransaction({
      customer: "Ramesh",
      items: [
        { name: "Sugar", quantity: "2 kg", price: 90 },
        { name: "Tata Salt", quantity: "1 packet", price: 25 },
      ],
      payment: "Udhar",
      total: 115,
    });

    setStatus("preview");
    setMessage("");
  };

  const startRecording = () => {
    setIsRecording(true);
    setStatus("recording");
    setMessage("Listening... Speak your transaction.");
  };

  const stopRecording = () => {
    setIsRecording(false);
    setStatus("idle");
    setMessage(
      "Recording UI demo only. Use 'Try demo command' to preview a transaction."
    );
  };

  const confirmTransaction = () => {
    setStatus("confirmed");
    setMessage("Demo transaction confirmed successfully!");
  };

  const cancelTransaction = () => {
    setTranscript("");
    setTransaction(null);
    setStatus("idle");
    setMessage("Transaction cancelled.");
  };

  const resetAssistant = () => {
    setTranscript("");
    setTransaction(null);
    setStatus("idle");
    setMessage("");
    setIsRecording(false);
  };

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
          <Sparkles size={16} />
          VoiceMunim Assistant
        </div>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          Voice Assistant
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your shop using simple voice commands.
        </p>
      </div>

      {/* Microphone section */}
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <AudioLines size={30} />
        </div>

        <h2 className="text-lg font-semibold text-gray-900">
          How can I help you today?
        </h2>

        <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
          Tap the microphone and speak naturally. You can record sales,
          update inventory, and manage customer credit.
        </p>

        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`mx-auto mt-7 flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition ${
            isRecording
              ? "animate-pulse bg-red-500 hover:bg-red-600"
              : "bg-emerald-700 hover:bg-emerald-800"
          }`}
        >
          {isRecording ? <MicOff size={30} /> : <Mic size={30} />}
        </button>

        <p className="mt-4 text-sm font-semibold text-gray-700">
          {isRecording ? "Recording..." : "Tap to start"}
        </p>

        <p className="mt-1 text-xs text-gray-400">
          {isRecording
            ? "Tap again to stop the demo recording"
            : "Supports natural language commands"}
        </p>

        {message && (
          <p className="mt-4 text-sm text-emerald-700">{message}</p>
        )}

        <button
          onClick={loadDemo}
          className="mt-5 rounded-lg border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
        >
          Try demo command
        </button>
      </div>

      {/* Transcription */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">
              Transcription Preview
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Your spoken words will appear here.
            </p>
          </div>
          <AudioLines className="text-emerald-700" size={22} />
        </div>

        <div className="min-h-20 rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-700">
          {transcript || (
            <span className="text-gray-400">
              No voice command yet. Try the demo command above.
            </span>
          )}
        </div>
      </div>

      {/* Transaction preview */}
      {transaction && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">
                Transaction Preview
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                Check the details before confirming.
              </p>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              {status === "confirmed" ? "Confirmed" : "Awaiting confirmation"}
            </span>
          </div>

          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Customer</p>
              <p className="mt-1 font-semibold text-gray-900">
                {transaction.customer}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Payment type</p>
              <p className="mt-1 font-semibold text-gray-900">
                {transaction.payment}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-gray-500">
                  <th className="py-3">Product</th>
                  <th className="py-3">Quantity</th>
                  <th className="py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transaction.items.map((item, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-3 font-medium text-gray-800">
                      {item.name}
                    </td>
                    <td className="py-3 text-gray-600">{item.quantity}</td>
                    <td className="py-3 text-right text-gray-800">
                      ₹{item.price}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <span className="font-semibold text-gray-700">Total Amount</span>
            <span className="text-xl font-bold text-emerald-700">
              ₹{transaction.total}
            </span>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={confirmTransaction}
              disabled={status === "confirmed"}
              className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 size={18} />
              Confirm Transaction
            </button>

            <button
              onClick={cancelTransaction}
              className="flex items-center gap-2 rounded-lg border border-red-200 px-5 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              <XCircle size={18} />
              Cancel
            </button>

            <button
              onClick={resetAssistant}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              <RotateCcw size={17} />
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Safety information */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
        <ShieldCheck className="mt-0.5 shrink-0 text-blue-700" size={21} />
        <div>
          <p className="text-sm font-semibold text-blue-900">
            Transaction Safety
          </p>
          <p className="mt-1 text-xs leading-5 text-blue-800">
            VoiceMunim will show transaction details for your approval before
            saving any sale or customer credit entry.
          </p>
        </div>
      </div>

      {/* Voice response control */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
            <Volume2 size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">
              Voice Response
            </p>
            <p className="text-xs text-gray-500">
              Audio playback will be connected to Gnani Timbre.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500">
          Coming soon
        </span>
      </div>
    </div>
  );
}
