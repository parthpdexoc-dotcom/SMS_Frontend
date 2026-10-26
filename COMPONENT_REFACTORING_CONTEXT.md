# Component Refactoring Context & Instructions

## Purpose
This document provides instructions for refactoring existing components to use the SMS component library (smsatoms, smsmolecules, smsorganisms) instead of raw HTML elements and custom CSS.

## When to Use This Guide
When you are given:
- A component name (e.g., "RequesterList", "PostForm")
- An image/screenshot of a component that needs refactoring

## Refactoring Objectives

### 1. Replace HTML Elements with SMS Components
- **Remove**: Raw `<div>`, `<span>`, `<button>`, `<input>`, etc.
- **Replace with**: SMS components from `smsatoms`, `smsmolecules`, `smsorganisms`

### 2. Remove Custom CSS
- **Remove**: Custom CSS classes and styles from component CSS files
- **Use**: SMS component props and Material-UI's `sx` prop for styling
- **Keep**: Only essential CSS that cannot be handled by SMS components

### 3. Preserve Logic
- **DO NOT CHANGE**: Component logic, state management, event handlers, API calls
- **ONLY CHANGE**: JSX structure and styling approach

### 4. Use ONLY SMS Components
- **DO NOT USE**: Components from `@/components/atoms`, `@/components/molecules`, or `@/components/organisms`
- **ONLY USE**: Components from `@/components/smsatoms`, `@/components/smsmolecules`, or `@/components/smsorganisms`
- **IF MISSING**: Create the missing component in the appropriate SMS folder (smsatoms, smsmolecules, or smsorganisms)

## Available SMS Components

### SMS Atoms (`@/components/smsatoms`)
Basic building blocks - use these for simple UI elements:

- **SMSBox** - Container (replaces `<div>`)
- **SMSStack** - Flex container with spacing (replaces `<div>` with flex)
- **SMSGrid** - Grid layout system (replaces CSS Grid)
- **SMSTypography** - Text elements (replaces `<h1>`, `<h2>`, `<p>`, `<span>`)
- **SMSButton** - Buttons (replaces `<button>`)
- **SMSTextField** - Text inputs (replaces `<input type="text">`)
- **SMSTextArea** - Textarea (replaces `<textarea>`)
- **SMSSelect** - Select dropdowns (replaces `<select>`)
- **SMSCheckbox** - Checkboxes (replaces `<input type="checkbox">`)
- **SMSRadio** - Radio buttons (replaces `<input type="radio">`)
- **SMSSwitch** - Toggle switches
- **SMSCard** - Card containers
- **SMSPaper** - Paper/elevated surface
- **SMSChip** - Chips/badges
- **SMSLabel** - Form labels
- **SMSHelperText** - Helper/error text
- **SMSTabs** - Tab navigation
- **SMSForm** - Form wrapper (replaces `<form>`)

### SMS Molecules (`@/components/smsmolecules`)
Composite components - use these for common UI patterns:

- **SMSFormField** - Form field with label, input, and error handling
- **SMSSearchBar** - Search input with icon
- **SMSFilterPanel** - Filter panel container
- **SMSDataDisplay** - Label-value display pairs
- **SMSStatusBadge** - Status badges with variants
- **SMSActionBar** - Action button bar
- **SMSBreadcrumb** - Breadcrumb navigation
- **SMSPagination** - Pagination controls
- **SMSAlert** - Alert/notification messages
- **SMSEmptyState** - Empty state display
- **SMSLoadingState** - Loading state display
- **SMSErrorState** - Error state display
- **SMSConfirmDialog** - Confirmation dialogs
- **SMSProgressBar** - Progress indicators

### SMS Organisms (`@/components/smsorganisms`)
Complex components - use these for complete features:

- **SMSPageLayout** - Page layout wrapper with spacing and padding
- **SMSListPage** - List page with title, filters, and content
- **SMSForm** - Complete form with validation
- **SMSDetailView** - Detail view with sections
- **SMSModal** - Modal dialogs
- **SMSDataTableWrapper** - Data table wrapper
- **SMSToolbar** - Toolbar component
- **SMSWizard** - Multi-step wizard
- **SMSMasterDetail** - Master-detail view

## Refactoring Process

### Step 1: Analyze the Component
1. Identify all HTML elements (`<div>`, `<span>`, `<button>`, etc.)
2. Identify all custom CSS classes
3. Understand the component's logic and functionality
4. Map HTML elements to appropriate SMS components

### Step 2: Replace HTML Elements

#### Common Replacements:

```tsx
// BEFORE: Raw divs
<div className="container">
  <div className="header">
    <h1>Title</h1>
  </div>
  <div className="content">
    <p>Content</p>
  </div>
</div>

// AFTER: SMS components
<SMSStack spacing={3}>
  <SMSStack direction="row" alignItems="center">
    <SMSTypography variant="h4">Title</SMSTypography>
  </SMSStack>
  <SMSBox>
    <SMSTypography variant="body1">Content</SMSTypography>
  </SMSBox>
</SMSStack>
```

```tsx
// BEFORE: Custom button
<button className="btn btn-primary" onClick={handleClick}>
  Click Me
</button>

// AFTER: SMSButton
<SMSButton variant="contained" color="primary" onClick={handleClick}>
  Click Me
</SMSButton>
```

```tsx
// BEFORE: Custom input
<input 
  type="text" 
  className="form-input" 
  value={value}
  onChange={handleChange}
/>

// AFTER: SMSTextField
<SMSTextField
  value={value}
  onChange={handleChange}
  fullWidth
/>
```

### Step 3: Remove CSS Classes
1. Remove className attributes that are replaced by SMS component props
2. Use `sx` prop for custom styling when needed
3. Remove corresponding CSS rules from `.css` files

```tsx
// BEFORE: Custom CSS class
<div className="card-container">
  <div className="card-header">Header</div>
</div>

// AFTER: SMS components with sx
<SMSCard sx={{ padding: 2 }}>
  <SMSTypography variant="h6" sx={{ marginBottom: 2 }}>
    Header
  </SMSTypography>
</SMSCard>
```

### Step 4: Use Layout Components
For page-level components, use SMS organisms:

```tsx
// BEFORE: Custom page structure
<div className="page-container">
  <div className="page-header">
    <h1>Page Title</h1>
  </div>
  <div className="page-content">
    {/* content */}
  </div>
</div>

// AFTER: SMSListPage or SMSPageLayout
<SMSListPage title="Page Title">
  {/* content */}
</SMSListPage>
```

### Step 5: Clean Up CSS Files
1. Remove CSS rules that are no longer needed
2. Keep only essential CSS that cannot be handled by SMS components
3. Remove unused CSS classes

### Step 6: Create Missing SMS Components (If Needed)
If a required component doesn't exist in SMS folders, create it:

1. **Determine the appropriate level**:
   - **Atom**: Basic, single-purpose UI element (Button, Input, Badge)
   - **Molecule**: Combination of 2-3 atoms (FormField, SearchBar)
   - **Organism**: Complex feature component (Form, DataTable, Modal)

2. **Create the component structure**:
   ```
   src/components/smsatoms/SMSComponentName/
   ├── SMSComponentName.tsx
   ├── SMSComponentName.module.css (if needed)
   └── index.ts
   ```

3. **Follow existing SMS component patterns**:
   - Use Material-UI components as base
   - Export TypeScript types
   - Use memo for performance
   - Follow naming convention (SMS prefix)

4. **Export from index files**:
   - Export from component's `index.ts`
   - Export from `smsatoms/index.ts`, `smsmolecules/index.ts`, or `smsorganisms/index.ts`

5. **Example - Creating a new SMS Atom**:
   ```tsx
   // SMSComponentName.tsx
   import { ComponentName, ComponentNameProps } from '@mui/material/ComponentName';
   import { FC, memo } from 'react';

   export interface SMSComponentNameProps extends ComponentNameProps {
     // Add any custom props if needed
   }

   export const SMSComponentName: FC<SMSComponentNameProps> = memo(({ ...props }) => {
     return <ComponentName {...props} />;
   });

   SMSComponentName.displayName = 'SMSComponentName';
   export default SMSComponentName;
   ```

6. **DO NOT**:
   - Import from old `atoms`, `molecules`, or `organisms` folders
   - Use old component patterns
   - Create components outside SMS folders

## Reference Project Pattern

When refactoring, refer to the reference project structure:
- Location: `reference project/src/components/organisms/`
- Pattern: Components use Material-UI components (Box, Stack, Typography) wrapped in custom components
- Our pattern: Use SMS components which are wrappers around Material-UI

## Import Patterns

### Atoms
```tsx
import { SMSBox, SMSStack, SMSTypography, SMSButton } from '@/components/smsatoms';
```

### Molecules
```tsx
import { SMSFormField, SMSSearchBar, SMSFilterPanel } from '@/components/smsmolecules';
```

### Organisms
```tsx
import { SMSPageLayout, SMSListPage, SMSForm } from '@/components/smsorganisms';
```

## Styling Guidelines

### Use `sx` Prop for Custom Styling
```tsx
<SMSBox sx={{ 
  padding: 2, 
  marginTop: 3,
  backgroundColor: 'background.paper'
}}>
```

### Use SMS Component Props
```tsx
<SMSStack spacing={3} direction="row" alignItems="center">
```

### Avoid Custom CSS Classes
- Don't create new CSS classes unless absolutely necessary
- Use SMS component props and `sx` prop instead

## Important Rules

1. **DO NOT CHANGE LOGIC**: Keep all state management, event handlers, API calls, and business logic unchanged
2. **PRESERVE FUNCTIONALITY**: Ensure the component works exactly the same after refactoring
3. **USE ONLY SMS COMPONENTS**: 
   - **ALWAYS** use components from `smsatoms`, `smsmolecules`, or `smsorganisms`
   - **NEVER** use components from old `atoms`, `molecules`, or `organisms` folders
   - **IF MISSING**: Create the missing component in the appropriate SMS folder
4. **CREATE MISSING COMPONENTS**: If a needed component doesn't exist in SMS folders, create it rather than using old components
5. **REMOVE CUSTOM CSS**: Remove CSS that can be replaced by SMS component props
6. **FOLLOW HIERARCHY**: Use atoms → molecules → organisms hierarchy
7. **MAINTAIN ACCESSIBILITY**: Ensure accessibility is maintained or improved

## Example: Complete Refactoring

### Before:
```tsx
import './MyComponent.css';

export const MyComponent = () => {
  const [value, setValue] = useState('');
  
  return (
    <div className="my-component">
      <div className="header">
        <h1 className="title">My Title</h1>
      </div>
      <div className="content">
        <input 
          className="input-field"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button className="btn-primary" onClick={handleSubmit}>
          Submit
        </button>
      </div>
    </div>
  );
};
```

### After:
```tsx
import { SMSStack, SMSTypography, SMSTextField, SMSButton } from '@/components/smsatoms';

export const MyComponent = () => {
  const [value, setValue] = useState('');
  
  return (
    <SMSStack spacing={3}>
      <SMSStack direction="row" alignItems="center">
        <SMSTypography variant="h4">My Title</SMSTypography>
      </SMSStack>
      <SMSStack spacing={2}>
        <SMSTextField
          value={value}
          onChange={(e) => setValue(e.target.value)}
          fullWidth
        />
        <SMSButton variant="contained" onClick={handleSubmit}>
          Submit
        </SMSButton>
      </SMSStack>
    </SMSStack>
  );
};
```

## Checklist

When refactoring a component, ensure:

- [ ] All `<div>` elements replaced with `SMSBox` or `SMSStack`
- [ ] All text elements replaced with `SMSTypography`
- [ ] All buttons replaced with `SMSButton`
- [ ] All inputs replaced with `SMSTextField`, `SMSTextArea`, `SMSSelect`, etc.
- [ ] All old component imports removed (no imports from `atoms`, `molecules`, `organisms`)
- [ ] Only SMS component imports used (`smsatoms`, `smsmolecules`, `smsorganisms`)
- [ ] Missing SMS components created (if needed)
- [ ] All custom CSS classes removed
- [ ] CSS file cleaned up (unused styles removed)
- [ ] Component logic unchanged
- [ ] Functionality preserved
- [ ] Imports updated to use SMS components
- [ ] Component tested to ensure it works correctly

## Component Creation Guidelines

### When to Create a New SMS Component

Create a new SMS component if:
- A needed component doesn't exist in `smsatoms`, `smsmolecules`, or `smsorganisms`
- You find yourself using an old component from `atoms`, `molecules`, or `organisms`
- You need a reusable UI pattern that doesn't exist yet

### Component Creation Process

1. **Check if it exists**: First, verify the component doesn't already exist in SMS folders
2. **Determine level**: Decide if it's an atom, molecule, or organism
3. **Create structure**: Follow the folder structure pattern
4. **Use Material-UI base**: Wrap Material-UI components (like existing SMS components)
5. **Export properly**: Export from component index and parent index files
6. **Use immediately**: Use the newly created component in your refactored code

### Forbidden Imports

**DO NOT IMPORT FROM:**
```tsx
// ❌ WRONG - Old components
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/FormField';
import { Modal } from '@/components/organisms/Modal';
```

**ONLY IMPORT FROM:**
```tsx
// ✅ CORRECT - SMS components
import { SMSButton, SMSCard } from '@/components/smsatoms';
import { SMSFormField } from '@/components/smsmolecules';
import { SMSModal } from '@/components/smsorganisms';
```

## Notes

- SMS components are wrappers around Material-UI components
- They accept all Material-UI props (via `sx`, `className`, etc.)
- Use TypeScript types from SMS components for better type safety
- Refer to existing refactored components for patterns
- When in doubt, check the reference project for similar patterns
- **Always create missing SMS components rather than using old components**

