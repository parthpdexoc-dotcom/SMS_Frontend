# Development Guide - Shift Management System

## Quick Reference

This guide provides detailed instructions for developing new components and features in this project.

## Component Development Workflow

### 1. Before Creating Any Component

**ALWAYS ask yourself:**
1. Does a similar component already exist?
2. Can I compose existing components to achieve this?
3. What's the smallest component I need to create?

### 2. Component Hierarchy Decision Tree

```
Need a UI element?
│
├─ Is it a basic, single element? (Button, Input, Badge, Avatar)
│  └─→ Create in ATOMS
│
├─ Does it combine 2-3 atoms? (FormField, SearchBar, Alert)
│  └─→ Create in MOLECULES
│
└─ Is it a complete feature? (Dashboard, Form, DataTable, Modal)
   └─→ Create in ORGANISMS
```

## Step-by-Step Component Creation

### Creating an Atom

**Example: Creating a Badge component**

1. **Create folder structure:**
   ```
   src/components/atoms/Badge/
   ├── Badge.tsx
   ├── Badge.css
   └── index.ts
   ```

2. **Add TypeScript type** in `src/types/index.ts`:
   ```typescript
   export interface BadgeProps extends BaseComponentProps {
     variant?: 'default' | 'success' | 'warning' | 'danger';
     size?: 'sm' | 'md' | 'lg';
     text: string;
   }
   ```

3. **Create component** in `Badge.tsx`:
   ```typescript
   import React from 'react';
   import { BadgeProps } from '@/types';
   import './Badge.css';

   export const Badge: React.FC<BadgeProps> = ({
     text,
     variant = 'default',
     size = 'md',
     className = '',
   }) => {
     return (
       <span className={`badge badge--${variant} badge--${size} ${className}`}>
         {text}
       </span>
     );
   };
   ```

4. **Create styles** in `Badge.css`:
   ```css
   .badge {
     display: inline-flex;
     padding: var(--spacing-xs) var(--spacing-sm);
     border-radius: var(--radius-full);
     font-size: 0.875rem;
     font-weight: 500;
     /* Use CSS variables */
   }
   ```

5. **Export** in `index.ts`:
   ```typescript
   export { Badge } from './Badge';
   export type { BadgeProps } from './Badge';
   ```

6. **Add to atoms index** in `src/components/atoms/index.ts`:
   ```typescript
   export { Badge } from './Badge';
   ```

### Creating a Molecule

**Example: Creating a SearchBar component**

1. **Check existing atoms**: Input ✅, Button ✅

2. **Create folder structure:**
   ```
   src/components/molecules/SearchBar/
   ├── SearchBar.tsx
   ├── SearchBar.css
   └── index.ts
   ```

3. **Add TypeScript type**:
   ```typescript
   export interface SearchBarProps extends BaseComponentProps {
     placeholder?: string;
     onSearch?: (value: string) => void;
     value?: string;
   }
   ```

4. **Create component using atoms**:
   ```typescript
   import React, { useState } from 'react';
   import { Input } from '@/components/smsatoms';
   import { Button } from '@/atoms/Button';
   import { SMSIcon } from '@/components/smsatoms';
   import { SearchBarProps } from '@/types';
   import './SearchBar.css';

   export const SearchBar: React.FC<SearchBarProps> = ({
     placeholder = 'Search...',
     onSearch,
     className = '',
   }) => {
     const [value, setValue] = useState('');

     const handleSearch = () => {
       onSearch?.(value);
     };

     return (
       <div className={`search-bar ${className}`}>
         <Input
           value={value}
           onChange={(e) => setValue(e.target.value)}
           placeholder={placeholder}
         />
         <Button onClick={handleSearch}>
           <SMSIcon name="search" size="sm" />
         </Button>
       </div>
     );
   };
   ```

### Creating an Organism

**Example: Creating a UserProfile organism**

1. **Check existing components**: SMSCard ✅, Button ✅, Icon ✅, StatCard ✅

2. **Create folder structure:**
   ```
   src/components/organisms/UserProfile/
   ├── UserProfile.tsx
   ├── UserProfile.css
   └── index.ts
   ```

3. **Create component using molecules and atoms**:
   ```typescript
   import React from 'react';
   import { SMSCard } from '@/components/smsatoms';
   import { Button } from '@/atoms/Button';
   import { SMSIcon } from '@/components/smsatoms';
   import { StatCard } from '@/molecules/StatCard';
   import './UserProfile.css';

   export interface UserProfileProps {
     userId: string;
     onEdit?: () => void;
   }

   export const UserProfile: React.FC<UserProfileProps> = ({
     userId,
     onEdit,
   }) => {
     // Fetch user data, manage state, etc.
     
     return (
       <div className="user-profile">
         <Card>
           {/* Use existing components */}
         </Card>
       </div>
     );
   };
   ```

## Common Scenarios & Solutions

### Scenario 1: Need a new button style
**Solution**: Extend existing Button atom with new variant prop
- Don't create a new button component
- Add variant to ButtonVariant type
- Add styles in Button.css

### Scenario 2: Need a form
**Solution**: 
- Use Input atom for fields
- Use FormField molecule if you need label + error
- Create Form organism that combines multiple FormFields
- Use Button atom for submit

### Scenario 3: Need a data table
**Solution**:
- Use SMSCard as container
- Create Table atom (if doesn't exist) or use HTML table
- Create TableRow, TableCell molecules
- Create DataTable organism that manages data, sorting, pagination

### Scenario 4: Need a modal
**Solution**:
- Use SMSCard for modal content
- Use Button atom for actions
- Create Modal organism with overlay
- Handle open/close state in organism

### Scenario 5: Need notifications/toasts
**Solution**:
- Create Toast atom (simple notification)
- Create ToastContainer organism (manages multiple toasts)
- Use SMSIcon for toast icons
- Use Button atom for close action

## TypeScript Patterns

### Extending BaseComponentProps
```typescript
export interface MyComponentProps extends BaseComponentProps {
  // Your specific props
  title: string;
  onClick?: () => void;
}
```

### Using Union Types for Variants
```typescript
export type ComponentVariant = 'primary' | 'secondary' | 'tertiary';
export type ComponentSize = 'sm' | 'md' | 'lg';
```

### Optional Props with Defaults
```typescript
export const Component: React.FC<ComponentProps> = ({
  variant = 'primary',  // Default value
  size = 'md',
  className = '',
}) => {
  // Component logic
};
```

## Styling Patterns

### Using CSS Variables
```css
.my-component {
  color: var(--primary-color);
  padding: var(--spacing-md);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}
```

### BEM-like Naming
```css
.component-name { }
.component-name__element { }
.component-name__element--modifier { }
```

### Responsive Design
```css
.component {
  /* Mobile first */
  padding: var(--spacing-sm);
}

@media (min-width: 768px) {
  .component {
    padding: var(--spacing-md);
  }
}
```

## Import Patterns

### ✅ Correct Imports
```typescript
import { Button } from '@/atoms/Button';
import { StatCard } from '@/molecules/StatCard';
import { Dashboard } from '@/organisms/Dashboard';
import { ButtonProps } from '@/types';
import { formatDate } from '@/utils';
```

### ❌ Wrong Imports
```typescript
import { Button } from '../../atoms/Button';
import { Button } from '../../../components/atoms/Button';
```

## Testing Your Component

### Checklist Before Committing:
- [ ] Component follows atomic design hierarchy
- [ ] Uses existing components where possible
- [ ] TypeScript types are defined
- [ ] CSS uses variables from variables.css
- [ ] Component is responsive (test on mobile)
- [ ] Exported properly in index.ts
- [ ] No code duplication
- [ ] Props are well-typed
- [ ] Handles edge cases (empty states, loading, errors)
- [ ] Accessible (keyboard navigation, ARIA labels)

## Examples of Good vs Bad

### ❌ Bad: Creating duplicate button
```typescript
// Don't do this
export const PrimaryButton = () => {
  return <button className="primary-btn">Click</button>;
};
```
**Why bad**: Button atom already exists with variant prop

### ✅ Good: Using existing button
```typescript
import { Button } from '@/atoms/Button';
<Button variant="primary">Click</Button>
```

### ❌ Bad: Creating component in wrong level
```typescript
// Don't put this in atoms
export const UserCard = () => {
  return (
    <SMSCard sx={{ p: 2 }}>
      <SMSIcon name="person" size="sm" />
      <Text />
      <Button />
    </SMSCard>
  );
};
```
**Why bad**: Combines multiple atoms, should be molecule or organism

### ✅ Good: Proper hierarchy
```typescript
// In molecules/UserCard
import { SMSCard } from '@/components/smsatoms';
import { SMSIcon } from '@/components/smsatoms';
import { Button } from '@/atoms/Button';
```

## Getting Help

When requesting new features, provide:
- What you need (brief description)
- Where it will be used
- Any specific requirements

The AI will:
- Check existing components
- Follow atomic design
- Create missing atoms first
- Compose properly
- Follow all conventions

## Remember

1. **Reuse > Create**: Always check existing components first
2. **Atoms → Molecules → Organisms**: Follow the hierarchy
3. **Type Everything**: All props must be typed
4. **Style Consistently**: Use CSS variables
5. **Keep It Simple**: Start simple, refactor later if needed
6. **Make It Responsive**: Mobile-first approach
7. **Export Properly**: Always create index.ts files

---

For detailed architecture information, see `.cursorrules` file.

