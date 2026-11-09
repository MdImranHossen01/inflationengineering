const fs = require('fs');
const path = require('path');

const sourceDir = path.resolve(__dirname, '..');
const targets = [
  'D:\\project\\demo',
  'D:\\project\\CDIDoorInd'
];

const newFiles = [
  'src/app/(admin)/admin/expenses-incomes/page.tsx',
  'src/components/admin/TransactionForm.tsx',
  'src/app/api/admin/expenses-incomes/route.ts',
  'src/app/api/admin/expenses-incomes/[id]/route.ts',
  'src/app/api/admin/ledger/transactions/route.ts',
  'src/app/api/admin/ledger/transactions/[id]/route.ts'
];

const modifiedFiles = [
  'src/app/(admin)/admin/bills/page.tsx',
  'src/app/(admin)/admin/chalans/page.tsx',
  'src/app/(admin)/admin/ledger/page.tsx',
  'src/app/(admin)/admin/offers/page.tsx',
  'src/app/(admin)/admin/supplier-bills/page.tsx',
  'src/app/(admin)/admin/suppliers/page.tsx',
  'src/app/api/admin/dashboard/stats/route.ts',
  'src/components/layout/AppSidebar.tsx',
  'src/lib/ledgerHelper.ts',
  'src/models/Expense.ts'
];

const deletedFiles = [
  'src/app/(admin)/admin/expenses/page.tsx',
  'src/app/api/admin/expenses/[id]/route.ts',
  'src/app/api/admin/expenses/route.ts',
  'src/components/admin/ExpenseForm.tsx'
];

function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

targets.forEach(target => {
  console.log(`\n==========================================`);
  console.log(`Syncing to target: ${target}`);
  console.log(`==========================================`);

  if (!fs.existsSync(target)) {
    console.error(`Target directory does not exist: ${target}`);
    return;
  }

  // 1. Delete deleted files
  deletedFiles.forEach(fileRelPath => {
    const dest = path.join(target, fileRelPath);
    if (fs.existsSync(dest)) {
      console.log(`Deleting: ${fileRelPath}`);
      fs.unlinkSync(dest);
    }
  });

  // 2. Copy new files
  newFiles.forEach(fileRelPath => {
    const src = path.join(sourceDir, fileRelPath);
    const dest = path.join(target, fileRelPath);
    if (fs.existsSync(src)) {
      console.log(`Copying new file: ${fileRelPath}`);
      ensureDirectoryExistence(dest);
      fs.copyFileSync(src, dest);
    } else {
      console.warn(`Source file not found: ${src}`);
    }
  });

  // 3. Copy modified files (overwrite)
  modifiedFiles.forEach(fileRelPath => {
    const src = path.join(sourceDir, fileRelPath);
    const dest = path.join(target, fileRelPath);
    if (fs.existsSync(src)) {
      console.log(`Updating modified file: ${fileRelPath}`);
      ensureDirectoryExistence(dest);
      fs.copyFileSync(src, dest);
    } else {
      console.warn(`Source file not found: ${src}`);
    }
  });

  console.log(`Finished syncing to: ${target}`);
});
