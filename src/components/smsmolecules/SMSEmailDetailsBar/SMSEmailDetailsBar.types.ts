export interface SMSEmailDetailsItem {
  label: string;
  value: string;
}

export interface SMSEmailDetailsBarProps {
  items: SMSEmailDetailsItem[];
  className?: string;
}
