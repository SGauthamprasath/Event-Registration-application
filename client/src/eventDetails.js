// Hand-authored supplementary details for the IAC 2026 events.
// Keyed by event id (matching the DB seed order).
export const EVENT_DETAILS = {
  1: {
    track: 'Inauguration & Keynote',
    speaker: {
      name: 'Mr. Shriram Vasudevan',
      role: 'Director',
      org: 'Industrial AI & Agentic AI Solutions, Accenture',
    },
    topic: 'Innovation — Can You Be Innovative?',
    agenda: [
      ['09:00', 'Lamp lighting & inaugural address'],
      ['09:20', 'Welcome note — HoD, AI & DS'],
      ['09:35', 'Keynote: Innovation — Can you be innovative?'],
      ['10:15', 'Open Q & A'],
      ['10:30', 'Vote of thanks'],
    ],
    takeaways: [
      'The difference between improvement and real innovation.',
      'How industry teams structure day-to-day creative work.',
      'Honest patterns and anti-patterns from Accenture\'s AI practice.',
    ],
    audience: 'All AI & DS students, open to other departments.',
    organiser: 'Department of AI & Data Science',
  },
  2: {
    track: 'Keynote',
    speaker: {
      name: 'Mr. Thirumoorthi T',
      role: 'Senior Software Engineer',
      org: 'Imperva, Bengaluru',
    },
    topic: 'Weaponized Autonomy: Surviving "Excessive Agency" in Agentic AI',
    agenda: [
      ['11:00', 'Why "excessive agency" is a real class of risk'],
      ['11:25', 'Threat models for agentic systems'],
      ['11:55', 'Hardening patterns & guardrails'],
      ['12:20', 'Q & A'],
    ],
    takeaways: [
      'A clear definition of excessive agency vs. normal tool use.',
      'Attack scenarios on retrieval + tool-calling pipelines.',
      'Pragmatic mitigation patterns to apply to your own projects.',
    ],
    audience: 'Final-year AI & DS, CSE, IT students; faculty welcome.',
    organiser: 'Department of AI & Data Science',
  },
  3: {
    track: 'Keynote',
    speaker: {
      name: 'Mr. Ashok Kumar Mohan',
      role: 'Founder & Director, Head of DFIR',
      org: 'Kriyavan Cyber Forensic Service Pvt. Ltd.',
    },
    topic: 'Cyber Forensics',
    agenda: [
      ['13:30', 'A day in the life of a DFIR responder'],
      ['14:15', 'Live walkthrough — disk & memory artifacts'],
      ['15:15', 'Case study: investigating a lateral-movement incident'],
      ['16:10', 'Careers in cyber forensics'],
      ['16:30', 'Close'],
    ],
    takeaways: [
      'The incident-response lifecycle used by real teams.',
      'How evidence is collected without contaminating it.',
      'What hiring managers look for in forensics graduates.',
    ],
    audience: 'Open to all; AI & DS students strongly encouraged.',
    organiser: 'Department of AI & Data Science',
  },
  4: {
    track: 'Keynote',
    speaker: {
      name: 'Mr. Vivek Amruth Chinnasamy',
      role: 'Founder & CEO',
      org: 'XCODITS',
    },
    topic: 'AI for Cybersecurity',
    agenda: [
      ['09:00', 'Where AI actually helps a SOC today'],
      ['09:45', 'Detection engineering with LLMs'],
      ['10:45', 'Hands-on demo — triaging a fake incident'],
      ['12:00', 'Q & A and discussion'],
      ['12:30', 'Close'],
    ],
    takeaways: [
      'A grounded view of what AI can and cannot do for security.',
      'How to evaluate tools without falling for demos.',
      'Starter projects you can build this semester.',
    ],
    audience: 'AI & DS, CSE, IT students interested in security.',
    organiser: 'Department of AI & Data Science',
  },
  5: {
    track: 'Project Expo',
    speaker: {
      name: 'Mr. Vivek Amruth Chinnasamy',
      role: 'Senior Consultant',
      org: 'Triple-id, Netherlands (Off Campus Chennai)',
    },
    topic: 'Project Expo — Innovative ideas & creative solutions',
    agenda: [
      ['13:30', 'Expo opens · stall walkthroughs'],
      ['14:30', 'Shortlisted team demos (10 min each)'],
      ['16:00', 'Judge deliberation'],
      ['16:20', 'Awards & vote of thanks'],
      ['16:30', 'Close'],
    ],
    takeaways: [
      'Showcase working prototypes to industry visitors.',
      'Pitch practice in a low-stakes but real setting.',
      'Chance to be scouted for internships.',
    ],
    audience: 'Participating teams + open visitors.',
    organiser: 'Department of AI & Data Science',
  },
}
