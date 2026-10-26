module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
  overrides: [
    {
      files: ['**/components/smsatoms/SMSGrid/SMSGrid.tsx'],
      rules: {
        'no-restricted-imports': 'off',
      },
    },
    {
      files: ['**/*.{ts,tsx}'],
      excludedFiles: ['**/components/smsatoms/SMSGrid/SMSGrid.tsx'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: '@mui/material/Grid',
                message:
                  'Use SMSGrid from @/components/smsatoms instead of importing MUI Grid directly.',
              },
              {
                name: '@mui/material',
                importNames: ['Grid'],
                message:
                  'Use SMSGrid from @/components/smsatoms instead of importing Grid from @mui/material.',
              },
            ],
          },
        ],
      },
    },
  ],
}

