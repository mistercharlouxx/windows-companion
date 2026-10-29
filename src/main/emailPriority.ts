export type EmailCandidate = { id: string; subject: string; from: string; snippet: string; labelIds: string[]; date: string };

const urgentTerms = ['urgent', 'action required', 'deadline', 'due ', 'overdue', 'asap', 'today', 'tomorrow', 'exam', 'assignment', 'project', 'meeting', 'interview', 'invoice', 'payment', 'security alert'];
const lowValueTerms = ['newsletter', 'unsubscribe', 'promotion', 'sale', 'discount', 'digest', 'no-reply'];

export function scoreImportantEmail(email: EmailCandidate) {
  const text = `${email.subject} ${email.snippet} ${email.from}`.toLowerCase();
  let score = 0;
  if (email.labelIds.includes('IMPORTANT')) score += 6;
  if (email.labelIds.includes('STARRED')) score += 5;
  if (email.labelIds.includes('UNREAD')) score += 2;
  score += urgentTerms.filter(term => text.includes(term)).length * 3;
  score -= lowValueTerms.filter(term => text.includes(term)).length * 2;
  if (/\b(mon|tue|wed|thu|fri|sat|sun)(day)?\b|\b\d{1,2}[/:]\d{1,2}\b|\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(text)) score += 2;
  return score;
}

export function rankImportantEmails(emails: EmailCandidate[], limit = 8) {
  return emails.map(email => ({ ...email, priorityScore: scoreImportantEmail(email) })).sort((a, b) => b.priorityScore - a.priorityScore).slice(0, limit);
}
