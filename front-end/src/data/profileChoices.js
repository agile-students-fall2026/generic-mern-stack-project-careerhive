export const majorChoices = [
  'Computer Science', 'Data Science', 'Information Systems',
  'Engineering', 'Business', 'Design', 'Other',
].map(value => ({ value, label: value }))

export const stateChoices = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California',
  'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia',
  'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland',
  'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri',
  'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
  'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
].map(value => ({ value, label: value }))

export const workChoices = [
  { value: 'U.S. citizen or permanent resident', label: 'U.S. citizen / green card' },
  { value: 'Canadian citizen', label: 'Canadian citizen' },
  { value: 'Authorized to work; future sponsorship needed (OPT)', label: 'OPT — future sponsorship' },
  { value: 'Authorized to work; future sponsorship needed (STEM OPT)', label: 'STEM OPT — future sponsorship' },
  { value: 'Requires visa sponsorship (e.g., H-1B)', label: 'Needs sponsorship (e.g., H-1B)' },
]

// shortcut: demo graduation terms are May/December; expand when other terms are required.
const firstYear = new Date().getFullYear() - 1
export const graduationChoices = Array.from({ length: 8 }, (_, index) => firstYear + index)
  .flatMap(year => [
    { value: `${year}-05-01`, label: `May ${year}` },
    { value: `${year}-12-01`, label: `December ${year}` },
  ])
