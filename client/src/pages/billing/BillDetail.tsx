import { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, Download, ArrowLeft, HeartPulse, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function BillDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBill = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/billing/${id}`, { withCredentials: true });
        setBill(res.data);
      } catch (err) {
        console.error('Failed to fetch bill details', err);
        toast.error('Failed to load invoice details');
      } finally {
        setLoading(false);
      }
    };
    fetchBill();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    if (!bill) return;

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(22);
      doc.setTextColor(16, 185, 129); // emerald-500
      doc.text('MediSync HMS', 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text('123 Health Avenue, Bangalore, KA 560001', 14, 28);
      doc.text('Phone: +91 800 123 4567 | Email: billing@medisync.in', 14, 34);

      // Title
      doc.setFontSize(24);
      doc.setTextColor(30);
      doc.text('TAX INVOICE', pageWidth - 14, 25, { align: 'right' });
      
      doc.setFontSize(10);
      doc.text(`Bill No: ${bill.billNumber || bill.invoiceNumber || 'PENDING'}`, pageWidth - 14, 34, { align: 'right' });
      doc.text(`Date: ${format(new Date(bill.createdAt || new Date()), 'dd MMM yyyy')}`, pageWidth - 14, 40, { align: 'right' });

      doc.setDrawColor(220);
      doc.line(14, 45, pageWidth - 14, 45);

      // Details Block
      doc.setFontSize(11);
      doc.setTextColor(50);
      doc.text('BILL TO:', 14, 55);
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text(bill.patient?.name || 'Unknown Patient', 14, 62);
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(`Patient ID: ${bill.patient?._id?.substring(0, 8)} | Email: ${bill.patient?.email}`, 14, 68);

      doc.setFontSize(11);
      doc.setTextColor(50);
      doc.text('ATTENDING DOCTOR:', pageWidth / 2, 55);
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text(`Dr. ${bill.doctor?.name || 'Unassigned'}`, pageWidth / 2, 62);
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(`Dept: ${bill.doctor?.specialization || 'General'}`, pageWidth / 2, 68);

      // Table
      const tableColumn = ["Description", "Quantity", "Unit Price (INR)", "Total (INR)"];
      const tableRows: any[] = [];

      const itemsToRender = (bill.lineItems && bill.lineItems.length > 0) ? bill.lineItems : bill.items || [];
      itemsToRender.forEach((item: any) => {
        const itemData = [
          item.description || item.desc,
          item.quantity || item.qty,
          `${(item.unitPrice || item.price).toLocaleString('en-IN')}`,
          `${(item.total || (item.qty * item.price)).toLocaleString('en-IN')}`,
        ];
        tableRows.push(itemData);
      });

      (doc as any).autoTable({
        startY: 80,
        head: [tableColumn],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 5 },
        columnStyles: {
          1: { halign: 'center' },
          2: { halign: 'right' },
          3: { halign: 'right' }
        }
      });

      // Summary
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(10);
      doc.setTextColor(80);
      
      const sub = bill.subTotal || 0;
      const dsc = bill.discount || 0;
      const tx = bill.tax || 0;
      const tot = bill.totalAmount || 0;

      doc.text(`Subtotal:`, pageWidth - 60, finalY);
      doc.text(`Rs. ${sub.toLocaleString('en-IN')}`, pageWidth - 14, finalY, { align: 'right' });
      
      doc.text(`Discount:`, pageWidth - 60, finalY + 7);
      doc.text(`-Rs. ${dsc.toLocaleString('en-IN')}`, pageWidth - 14, finalY + 7, { align: 'right' });
      
      doc.text(`Tax (${tx}%):`, pageWidth - 60, finalY + 14);
      doc.text(`Rs. ${((sub * tx) / 100).toLocaleString('en-IN')}`, pageWidth - 14, finalY + 14, { align: 'right' });

      // Total Background
      doc.setFillColor(240, 253, 244); // bg-emerald-50 equivalent
      doc.rect(pageWidth - 80, finalY + 18, 66, 12, 'F');
      
      doc.setFontSize(12);
      doc.setTextColor(16, 185, 129);
      doc.setFont('helvetica', 'bold');
      doc.text(`TOTAL AMOUNT:`, pageWidth - 60, finalY + 26);
      doc.text(`Rs. ${tot.toLocaleString('en-IN')}`, pageWidth - 14, finalY + 26, { align: 'right' });

      // Footer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(150);
      const footerY = doc.internal.pageSize.getHeight() - 15;
      doc.text(`Generated by MediSync HMS | ${new Date().toLocaleString('en-IN')}`, pageWidth / 2, footerY, { align: 'center' });
      
      if (bill.status === 'Paid' || bill.paymentStatus === 'Paid') {
        doc.setTextColor(16, 185, 129);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.text('PAID', 14, finalY + 25);
      }

      doc.save(`MediSync_Bill_${bill.billNumber || 'Invoice'}.pdf`);
      toast.success('PDF Downloaded successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate PDF');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin text-emerald-600"><Printer size={32} /></div></div>;
  }

  if (!bill) {
    return <div className="text-center p-12 text-gray-500">Invoice not found.</div>;
  }

  const itemsToRender = (bill.lineItems && bill.lineItems.length > 0) ? bill.lineItems : bill.items || [];
  const isPaid = bill.status === 'Paid' || bill.paymentStatus === 'Paid';

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 print:bg-white print:py-0 print:px-0">
      
      <style>{`
        @media print {
          @page { size: A4; margin: 20mm; }
          body { background: white; -webkit-print-color-adjust: exact; color-adjust: exact; }
          #no-print-controls { display: none !important; }
          nav, aside, header { display: none !important; }
        }
      `}</style>

      {/* Screen Controls */}
      <div id="no-print-controls" className="max-w-4xl mx-auto mb-6 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
         <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium">
           <ArrowLeft size={18} /> Back to List
         </button>
         <div className="flex gap-3">
           <button onClick={handleDownloadPDF} className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-semibold hover:bg-indigo-100 transition">
             <Download size={18} /> Download PDF
           </button>
           <button onClick={handlePrint} className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg font-semibold shadow-md hover:bg-black transition">
             <Printer size={18} /> Print Invoice
           </button>
         </div>
      </div>

      {/* Invoice Document */}
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden print:shadow-none print:border-none print:w-full print:max-w-none">
        
        {/* Top Header stripe */}
        <div className="h-2 w-full bg-emerald-500"></div>

        <div className="p-8 sm:p-12">
          
          {/* Header */}
          <div className="flex justify-between items-start border-b border-gray-100 pb-8">
             <div>
               <div className="flex items-center gap-2 text-emerald-600 mb-2">
                 <HeartPulse size={36} strokeWidth={2.5} />
                 <h1 className="text-3xl font-black tracking-tight text-emerald-600">MediSync <span className="text-gray-800">HMS</span></h1>
               </div>
               <p className="text-sm text-gray-500 max-w-xs mt-4">
                 123 Health Avenue, Bangalore, KA 560001<br/>
                 Phone: +91 800 123 4567<br/>
                 Email: billing@medisync.in
               </p>
             </div>
             <div className="text-right">
               <h2 className="text-4xl font-light text-gray-300 tracking-wider mb-2">INVOICE</h2>
               <p className="font-mono text-gray-900 font-bold text-lg">{bill.billNumber || bill.invoiceNumber || 'DRAFT'}</p>
               <p className="text-sm text-gray-500 mt-1">Date: {format(new Date(bill.createdAt), 'dd MMM yyyy')}</p>
               
               <div className="mt-4 flex justify-end">
                 {isPaid ? (
                   <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded border border-emerald-200 inline-flex items-center gap-1.5 font-bold text-sm tracking-wide">
                     <CheckCircle size={16} /> PAID
                   </div>
                 ) : (
                   <div className="bg-orange-50 text-orange-700 px-3 py-1 rounded border border-orange-200 inline-flex items-center font-bold text-sm tracking-wide">
                     UNPAID
                   </div>
                 )}
               </div>
             </div>
          </div>

          {/* Parties block */}
          <div className="grid grid-cols-2 gap-8 my-8">
            <div>
              <h3 className="text-xs font-bold text-gray-400 tracking-wider uppercase mb-2">Bill To</h3>
              <p className="text-lg font-bold text-gray-900">{bill.patient?.name}</p>
              <p className="text-sm text-gray-600 mt-1">Patient ID: {bill.patient?._id}</p>
              <p className="text-sm text-gray-600">{bill.patient?.email}</p>
            </div>
            <div>
              <h3 className="text-xs font-bold text-gray-400 tracking-wider uppercase mb-2">Attending Doctor</h3>
              <p className="text-lg font-bold text-gray-900">Dr. {bill.doctor?.name || 'Unassigned'}</p>
              <p className="text-sm text-gray-600 mt-1">Department: {bill.doctor?.specialization}</p>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full text-left border-collapse mt-8">
            <thead>
              <tr className="bg-gray-50">
                <th className="py-3 px-4 font-bold text-sm text-gray-700 border-y border-gray-200">Description</th>
                <th className="py-3 px-4 font-bold text-sm text-gray-700 border-y border-gray-200 text-center">Qty</th>
                <th className="py-3 px-4 font-bold text-sm text-gray-700 border-y border-gray-200 text-right">Unit Price</th>
                <th className="py-3 px-4 font-bold text-sm text-gray-700 border-y border-gray-200 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {itemsToRender.map((item: any, idx: number) => (
                <tr key={idx} className="border-b border-gray-100 last:border-b-0">
                  <td className="py-4 px-4 text-sm font-medium text-gray-900">{item.description || item.desc}</td>
                  <td className="py-4 px-4 text-sm text-gray-600 text-center">{item.quantity || item.qty}</td>
                  <td className="py-4 px-4 text-sm text-gray-600 text-right">₹{(item.unitPrice || item.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="py-4 px-4 text-sm font-bold text-gray-900 text-right">₹{(item.total || (item.qty * item.price)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals Box */}
          <div className="flex justify-end mt-8">
            <div className="w-full sm:w-1/2 lg:w-1/3">
              <div className="flex justify-between py-2 text-sm text-gray-600">
                <span>Subtotal</span>
                <span>₹{(bill.subTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              {bill.discount > 0 && (
                <div className="flex justify-between py-2 text-sm text-emerald-600">
                  <span>Discount</span>
                  <span>- ₹{bill.discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {bill.tax > 0 && (
                <div className="flex justify-between py-2 text-sm text-gray-600 border-b border-gray-100">
                  <span>Tax ({bill.tax}%)</span>
                  <span>₹{((bill.subTotal || 0) * (bill.tax) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between py-4 text-xl font-black text-emerald-600 bg-emerald-50 px-4 rounded-lg mt-2">
                <span>TOTAL</span>
                <span>₹{(bill.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
            <p>Notes: {bill.notes || 'Thank you for choosing MediSync.'}</p>
            <p>Generated digitally at {new Date().toLocaleString('en-IN')}</p>
          </div>

        </div>
      </div>
    </div>
  );
}
