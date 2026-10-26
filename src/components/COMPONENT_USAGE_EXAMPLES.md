# Component Usage Examples

## Label Component (Atom)

**Location**: `src/components/atoms/Label`

**Usage**:
```tsx
import { Label } from '@/atoms/Label';

// Basic label
<Label htmlFor="username">Username</Label>

// Required label
<Label htmlFor="email" required>Email Address</Label>

// With variants
<Label variant="primary">Primary Label</Label>
<Label variant="success">Success Label</Label>
<Label variant="danger">Danger Label</Label>

// Different sizes
<Label size="sm">Small Label</Label>
<Label size="md">Medium Label (default)</Label>
<Label size="lg">Large Label</Label>

// With form input
<Label htmlFor="password" required>Password</Label>
<Input id="password" type="password" />
```

**Props**:
- `htmlFor?: string` - Associates label with form element
- `required?: boolean` - Shows asterisk (*) for required fields
- `variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info'`
- `size?: 'sm' | 'md' | 'lg'`
- `className?: string`

---

## Tab Component (Molecule)

**Location**: `src/components/smsmolecules/Tab`

**Usage**:
```tsx
import { Tab } from '@/components/smsmolecules/Tab';

// Basic tab
<Tab
  id="tab1"
  label="Overview"
  active={activeTab === 'tab1'}
  onClick={(id) => setActiveTab(id)}
/>

// Tab with icon
<Tab
  id="tab2"
  label="Settings"
  icon="settings"
  active={activeTab === 'tab2'}
  onClick={(id) => setActiveTab(id)}
/>

// Disabled tab
<Tab
  id="tab3"
  label="Disabled"
  disabled
  onClick={(id) => setActiveTab(id)}
/>
```

**Props**:
- `id: string` - Unique identifier for the tab
- `label: string` - Tab label text
- `icon?: string` - Icon name (optional)
- `active?: boolean` - Whether tab is active
- `disabled?: boolean` - Whether tab is disabled
- `onClick?: (id: string) => void` - Click handler
- `className?: string`

---

## Tabs Component (Organism)

**Location**: `src/components/organisms/Tabs`

**Usage**:
```tsx
import { Tabs } from '@/organisms/Tabs';

// Basic tabs
<Tabs
  tabs={[
    {
      id: 'overview',
      label: 'Overview',
      content: <div>Overview content</div>
    },
    {
      id: 'settings',
      label: 'Settings',
      content: <div>Settings content</div>
    },
    {
      id: 'profile',
      label: 'Profile',
      content: <div>Profile content</div>
    }
  ]}
  defaultActiveTab="overview"
  onChange={(tabId) => console.log('Tab changed:', tabId)}
/>

// Tabs with icons
<Tabs
  tabs={[
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: 'dashboard',
      content: <Dashboard />
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: 'document',
      content: <Reports />
    }
  ]}
/>

// Tabs with different variants
<Tabs
  variant="pills"
  tabs={[...]}
/>

<Tabs
  variant="underline"
  tabs={[...]}
/>
```

**Props**:
- `tabs: TabItem[]` - Array of tab items
- `defaultActiveTab?: string` - Initial active tab ID
- `onChange?: (tabId: string) => void` - Tab change handler
- `variant?: 'default' | 'pills' | 'underline'`
- `className?: string`

**TabItem Interface**:
```typescript
interface TabItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  content?: React.ReactNode;
}
```

---

## SMSCard (`smsatoms`)

**Location**: `src/components/smsatoms/SMSCard`

**Usage** (MUI `Card` wrapper; use `padding` for app spacing scale or `sx` for ad-hoc styles):
```tsx
import { SMSCard } from '@/components/smsatoms';

<SMSCard sx={{ p: 2 }} elevation={1}>
  <p>Card content</p>
</SMSCard>

<SMSCard padding="md" elevation={1}>Medium padding</SMSCard>
```

---

## Complete Example: Using All Components Together

```tsx
import React, { useState } from 'react';
import { SMSCard } from '@/components/smsatoms';
import { Label } from '@/atoms/Label';
import { Input } from '@/components/smsatoms';
import { Tabs } from '@/organisms/Tabs';
import { SMSButton } from '@/components/smsatoms';

const ExamplePage = () => {
  const [formData, setFormData] = useState({ name: '', email: '' });

  return (
    <div>
      {/* Using Tabs */}
      <Tabs
        tabs={[
          {
            id: 'form',
            label: 'Form',
            icon: 'document',
            content: (
              <SMSCard padding="lg" elevation={1}>
                <Label htmlFor="name" required>Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
                
                <Label htmlFor="email" required variant="primary">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
                
                <SMSButton variant="contained" color="primary">Submit</SMSButton>
              </SMSCard>
            )
          },
          {
            id: 'info',
            label: 'Information',
            icon: 'info',
            content: (
              <SMSCard padding="lg" elevation={1}>
                <h2>Information Tab</h2>
                <p>This is the information content.</p>
              </SMSCard>
            )
          }
        ]}
        defaultActiveTab="form"
      />
    </div>
  );
};
```

---

## Component Hierarchy Summary

- **Card** → **Atom** (basic container element)
- **Label** → **Atom** (basic text element)
- **Tab** → **Molecule** (combines label + icon + state)
- **Tabs** → **Organism** (combines multiple Tab molecules + content management)

All components follow the atomic design pattern and are fully typed with TypeScript.

