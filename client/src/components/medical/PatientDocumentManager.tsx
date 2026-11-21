import React, { useState, useEffect } from "react";
import {
  FileText,
  UploadCloud,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  FileCheck,
} from "lucide-react";
import Card, { CardContent, CardHeader } from "../ui/Card";
import Button from "../ui/Button";
import { toast } from "react-toastify";
import {
  getPatientDocuments,
  uploadPatientDocument,
  deletePatientDocument,
  type PatientDocument,
} from "../../api/aiCompanionApi";

export const PatientDocumentManager: React.FC = () => {
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("lab_report");

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const docs = await getPatientDocuments();
      setDocuments(docs);
    } catch (err: any) {
      console.error("Failed to load documents", err);
      toast.error("Failed to load medical records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error("File is too large. Maximum size is 15 MB.");
      return;
    }

    try {
      setUploading(true);
      toast.info("Extracting text and indexing embeddings with Ollama...");
      const res = await uploadPatientDocument(file, selectedCategory);
      if (res.success) {
        toast.success(`"${file.name}" indexed successfully for AI Care Companion!`);
        await loadDocuments();
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.detail || "Document upload and indexing failed";
      toast.error(errMsg);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (docId: string, filename: string) => {
    if (!window.confirm(`Delete "${filename}" and its vector indices permanently?`)) {
      return;
    }

    try {
      await deletePatientDocument(docId);
      toast.success("Document and AI embeddings deleted");
      setDocuments((prev) => prev.filter((d) => d.document_id !== docId));
    } catch (err: any) {
      toast.error("Failed to delete document");
    }
  };

  return (
    <Card className="border border-slate-200 shadow-sm mt-6">
      <CardHeader
        title={
          <div className="flex items-center gap-2 text-slate-800">
            <FileCheck className="h-5 w-5 text-indigo-600" />
            <span>My Uploaded Medical Documents (RAG)</span>
          </div>
        }
        subtitle="Upload PDF or TXT reports (blood tests, discharge summaries, scans) to query them with your AI Care Companion."
        action={
          <div className="flex items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="lab_report">Laboratory / Blood Report</option>
              <option value="diagnostic_scan">Radiology / Scan</option>
              <option value="discharge_summary">Discharge Summary</option>
              <option value="prescription_doc">Prescription Document</option>
              <option value="general_report">General Clinical Report</option>
            </select>

            <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded shadow-sm transition">
              <UploadCloud className="h-4 w-4" />
              {uploading ? "Indexing..." : "Upload & Index"}
              <input
                type="file"
                accept=".pdf,.txt"
                className="hidden"
                disabled={uploading}
                onChange={handleFileUpload}
              />
            </label>

            <Button
              variant="outline"
              size="sm"
              onClick={loadDocuments}
              className="h-8 w-8 p-0"
              title="Refresh list"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-slate-600 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      />
      <CardContent>
        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading indexed documents...</div>
        ) : documents.length === 0 ? (
          <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-lg">
            <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-600">No medical documents uploaded yet.</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Upload your lab reports above so the AI Care Companion can reference your exact medical results.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Document</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Pages / Chunks</th>
                  <th className="py-2.5 px-3">Uploaded</th>
                  <th className="py-2.5 px-3">AI Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map((doc) => (
                  <tr key={doc.document_id} className="hover:bg-slate-50/50 transition">
                    <td className="py-2.5 px-3 font-medium text-slate-800 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-indigo-500 shrink-0" />
                      <span className="truncate max-w-[180px] sm:max-w-[260px]">{doc.filename}</span>
                    </td>
                    <td className="py-2.5 px-3 capitalize text-slate-600">
                      {doc.category.replace("_", " ")}
                    </td>
                    <td className="py-2.5 px-3">
                      {doc.total_pages} pg ({doc.total_chunks} chunks)
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3">
                      {doc.status === "ready" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="h-3 w-3" /> Indexed
                        </span>
                      ) : doc.status === "processing" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                          <Clock className="h-3 w-3" /> Processing
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full" title={doc.error}>
                          <AlertCircle className="h-3 w-3" /> Failed
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleDelete(doc.document_id, doc.filename)}
                        className="text-slate-400 hover:text-red-600 transition p-1"
                        title="Delete Document & Vectors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
