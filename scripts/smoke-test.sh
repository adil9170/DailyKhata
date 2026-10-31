#!/usr/bin/env bash
# End-to-end API smoke test against a running dev server (fresh local DB).
# Usage: ./scripts/smoke-test.sh [base_url]
set -euo pipefail
B=${1:-http://127.0.0.1:8787}
T=$(mktemp -d); SA=$T/sa; CA=$T/ca; ST=$T/st
j() { curl -sS -H 'content-type: application/json' "$@"; }
ok() { echo "✔ $1"; }
check() { if ! echo "$2" | grep -q "$3"; then echo "✘ $1: $2"; exit 1; fi; ok "$1"; }

check setup-needed "$(j $B/api/auth/setup)" '"needed":true'
check setup-bad-token "$(j -X POST $B/api/auth/setup -d '{"setup_token":"x","email":"a@b.co","name":"A","password":"secret123"}')" 'Invalid setup token'
check setup "$(j -c $SA -X POST $B/api/auth/setup -d '{"setup_token":"dev-setup-token","email":"owner@dailykhata.app","name":"Owner","password":"SuperSecret1"}')" '"ok":true'
check me-super "$(j -b $SA $B/api/auth/me)" '"role":"super_admin"'
PLAN=$(j -b $SA $B/api/admin/plans | sed -E 's/.*"id":([0-9]+),"name":"Standard".*/\1/')
CO=$(j -b $SA -X POST $B/api/admin/companies -d "{\"name\":\"Sharma Cold Drinks\",\"plan_id\":$PLAN,\"admin_name\":\"Ravi\",\"admin_email\":\"ravi@sharma.in\",\"admin_password\":\"RaviPass123\",\"phone\":\"9999999999\"}")
check create-company "$CO" '"slug":"sharma-cold-drinks"'
CID=$(echo "$CO" | sed -E 's/.*"id":([0-9]+).*/\1/')
CO2=$(j -b $SA -X POST $B/api/admin/companies -d '{"name":"Other Shop","admin_name":"Om","admin_email":"om@other.in","admin_password":"OtherPass123"}')
check create-company-2 "$CO2" '"slug":"other-shop"'

check login-bad "$(j -X POST $B/api/auth/login -d '{"email":"ravi@sharma.in","password":"nope"}')" 'Incorrect'
check login "$(j -c $CA -X POST $B/api/auth/login -d '{"email":"ravi@sharma.in","password":"RaviPass123"}')" '"ok":true'
check cross-origin-blocked "$(j -b $CA -H 'origin: https://evil.example' -X POST $B/api/c/products -d '{"name":"X"}')" 'Cross-site'
check admin-forbidden "$(j -b $CA $B/api/admin/overview)" 'Super admin only'

D=2026-10-16
PARSED=$(j -b $CA -X POST $B/api/c/parse -d "{\"date\":\"$D\",\"text\":\"Sting 2 boxes ₹1,020 60\nCloud Nine 2 boxes 800 60\nCampa Orange 1 box 240 30\nCampa Black 1 box 240 30\nCampa Green 1 box 240 30\nZeera 1 box 170 24\nMango Juice 1 box 240 30\nLitchi 1 box 240 30\nGas 820\nWi-Fi 2500\nWater 875\n16 October Collection: ₹7,544\"}")
check parse "$PARSED" '"date":"2026-10-16"'
check parse-ai-text "$(j -b $CA -X POST $B/api/c/parse-ai -d "{\"date\":\"$D\",\"text\":\"aaj gas 820 diya, chai 40. Sharma se 3000 mila\"}")" '"amount":820'
BODY=$(echo "$PARSED" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s);console.log(JSON.stringify({date:p.date,purchases:p.purchases,expenses:p.expenses,collections:p.collections}))})')
check bulk-save "$(j -b $CA -X POST $B/api/c/bulk -d "$BODY")" '"created":12'
DAY=$(j -b $CA $B/api/c/day/$D)
check day-purchases "$DAY" '"total":319000'
check day-expenses "$DAY" '"total":419500'
check day-collection "$DAY" '"total":754400'
check day-profit-withheld "$DAY" '"status":"unavailable"'
# count closing stock for every product -> profit becomes actual
PIDS=$(echo "$DAY" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s);console.log(JSON.stringify({counts:p.report.products.map(x=>({product_id:x.product_id,closing_pieces:Math.floor(x.purchased/3)}))}))})')
check stock-count "$(j -b $CA -X PUT $B/api/c/day/$D/stock -d "$PIDS")" '"ok":true'
check cash-close "$(j -b $CA -X PUT $B/api/c/day/$D/closing -d '{"opening_cash":2000,"counted_cash":1900}')" 'counted_cash_paise'
DAY=$(j -b $CA $B/api/c/day/$D)
check day-profit-actual "$DAY" '"status":"actual"'
check cash-diff "$DAY" '"type":"cash_short"'
echo "$DAY" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s).report;console.log("   cash:",JSON.stringify(r.cash),"\n   profit:",JSON.stringify(r.profit))})'

check summary "$(j -b $CA "$B/api/c/reports/summary?from=2026-10-01&to=$D&group=week")" '"series"'
check export-xlsx "$(curl -sS -b $CA -o $T/x.xlsx -w '%{http_code} %{content_type}' "$B/api/c/export?from=$D&to=$D&format=xlsx")" 'spreadsheetml'
check export-csv "$(curl -sS -b $CA "$B/api/c/export?from=$D&to=$D&format=csv&type=purchases")" 'Sting'

# isolation: other company cannot see Sharma data
j -c $T/o -X POST $B/api/auth/login -d '{"email":"om@other.in","password":"OtherPass123"}' >/dev/null
check isolation-day "$(j -b $T/o $B/api/c/day/$D)" '"purchases":\[\]'
SID=$(j -b $CA $B/api/c/purchases?from=$D\&to=$D | sed -E 's/^\[\{"id":([0-9]+).*/\1/')
check isolation-edit "$(j -b $T/o -X DELETE $B/api/c/purchases/$SID)" 'Entry not found'
check super-header-ignored-for-company-user "$(j -b $T/o -H "x-company-id: $CID" $B/api/c/day/$D)" '"purchases":\[\]'

# team & permissions
check add-staff "$(j -b $CA -X POST $B/api/c/team -d '{"name":"Sonu","email":"sonu@sharma.in","password":"SonuPass123","role":"staff"}')" '"role":"staff"'
j -c $ST -X POST $B/api/auth/login -d '{"email":"sonu@sharma.in","password":"SonuPass123"}' >/dev/null
check staff-no-reports "$(j -b $ST "$B/api/c/reports/summary?from=$D&to=$D")" "permission"
check staff-no-delete "$(j -b $ST -X DELETE $B/api/c/purchases/$SID)" "permission"
check staff-can-add "$(j -b $ST -X POST $B/api/c/expenses -d "{\"date\":\"$D\",\"category\":\"Gas\",\"amount\":10}")" 'amount_paise":1000'

# upload (private) + audit
printf '\x89PNG\r\n\x1a\n' > $T/r.png
DOC=$(curl -sS -b $CA -F "file=@$T/r.png;type=image/png" -F kind=receipt -F date=$D $B/api/c/documents)
check upload "$DOC" '"kind":"receipt"'
DID=$(echo "$DOC" | sed -E 's/.*"id":([0-9]+).*/\1/')
check doc-private "$(curl -sS -o /dev/null -w '%{http_code}' $B/api/c/documents/$DID/file)" '401'
check doc-other-company "$(curl -sS -b $T/o -o /dev/null -w '%{http_code}' $B/api/c/documents/$DID/file)" '404'
check doc-owner "$(curl -sS -b $CA -o /dev/null -w '%{http_code}' $B/api/c/documents/$DID/file)" '200'
check audit "$(j -b $CA $B/api/c/audit)" '"action":"bulk_create"'

# super admin: view portal, suspend, backup
check super-portal "$(j -b $SA -H "x-company-id: $CID" $B/api/c/day/$D)" '"total":754400'
check backup "$(j -b $SA -X POST $B/api/admin/companies/$CID/backup)" '"key":"backups/'
check suspend "$(j -b $SA -X PUT $B/api/admin/companies/$CID -d '{"name":"Sharma Cold Drinks","status":"suspended"}')" '"status":"suspended"'
check suspended-login "$(j -X POST $B/api/auth/login -d '{"email":"ravi@sharma.in","password":"RaviPass123"}')" 'suspended'
check reactivate "$(j -b $SA -X PUT $B/api/admin/companies/$CID -d "{\"name\":\"Sharma Cold Drinks\",\"plan_id\":$PLAN,\"status\":\"active\"}")" '"status":"active"'
check overview "$(j -b $SA $B/api/admin/overview)" '"companies":2'

# ---- local-first sync: snapshot, idempotent create, delta, deletes, notes, isolation ----
js() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s);console.log($1)})"; }
# (suspending a company signs its users out, so sign in again)
j -c $CA -X POST $B/api/auth/login -d '{"email":"ravi@sharma.in","password":"RaviPass123"}' >/dev/null
j -c $ST -X POST $B/api/auth/login -d '{"email":"sonu@sharma.in","password":"SonuPass123"}' >/dev/null
SNAP=$(j -b $CA "$B/api/c/sync")
check sync-snapshot "$SNAP" '"reset":true'
check sync-snapshot-rows "$(echo "$SNAP" | js 'r.tables.purchases.upsert.length+"/"+r.tables.collections.upsert.length')" '^8/'
SEQ=$(echo "$SNAP" | js r.seq)
NEW=$(j -b $CA -X POST $B/api/c/collections -d "{\"date\":\"$D\",\"amount\":120,\"mode\":\"upi\",\"client_id\":\"cid-test-0001-aaaa\"}")
check create-with-client-id "$NEW" '"client_id":"cid-test-0001-aaaa"'
NID=$(echo "$NEW" | js r.id)
AGAIN=$(j -b $CA -X POST $B/api/c/collections -d "{\"date\":\"$D\",\"amount\":120,\"mode\":\"upi\",\"client_id\":\"cid-test-0001-aaaa\"}")
check retry-is-idempotent "$(echo "$AGAIN" | js 'r.id')" "^$NID\$"
check no-duplicate-row "$(j -b $CA "$B/api/c/collections?from=$D&to=$D" | js 'r.filter(x=>x.client_id==="cid-test-0001-aaaa").length')" '^1$'
DELTA=$(j -b $CA "$B/api/c/sync?since=$SEQ")
check delta-has-new-row "$(echo "$DELTA" | js 'r.reset+"/"+r.tables.collections.upsert.map(x=>x.id).join(",")')" "false/$NID"
SEQ2=$(echo "$DELTA" | js r.seq)
check delta-empty-when-nothing-new "$(j -b $CA "$B/api/c/sync?since=$SEQ2" | js 'Object.values(r.tables).every(t=>!t.upsert.length&&!t.delete.length)')" 'true'
j -b $CA -X DELETE $B/api/c/collections/$NID >/dev/null
check delta-has-delete "$(j -b $CA "$B/api/c/sync?since=$SEQ2" | js 'r.tables.collections.delete.join(",")')" "^$NID\$"
NOTE=$(j -b $CA -X PUT $B/api/c/notes/note-test-000001 -d '{"title":"Shop list","body":"Chai 3 x 12\nMilk 2 x 35","entry_date":"2026-10-16"}')
check note-upsert "$NOTE" '"title":"Shop list"'
check note-upsert-again "$(j -b $CA -X PUT $B/api/c/notes/note-test-000001 -d '{"title":"Shop list","body":"Chai 3 x 12"}' | js 'r.body')" '^Chai 3 x 12$'
check note-in-sync "$(j -b $CA "$B/api/c/sync?since=$SEQ2" | js 'r.tables.notes.upsert.length')" '^1$'
check note-isolation "$(j -b $T/o "$B/api/c/sync" | js 'r.tables.notes.upsert.length+"/"+r.tables.purchases.upsert.length')" '^0/0$'
check note-delete "$(j -b $CA -X DELETE $B/api/c/notes/note-test-000001)" '"deleted":true'
check sync-needs-permission "$(j -b $ST "$B/api/c/sync" | js 'typeof r.seq')" 'number'
# ---- bills: shared numbering, idempotent create, search, void, isolation ----
RS1=$(j -b $CA -X POST $B/api/c/bills/reserve -d '{"n":20,"after":3}')
check bills-reserve-after-legacy "$RS1" '"from":4,"to":23'
for i in 1 2 3 4 5 6; do j -b $CA -X POST $B/api/c/bills/reserve -d '{"n":10}' > $T/rs$i & done; wait
check bills-reserve-race-no-overlap "$(cat $T/rs? | sed -E 's/.*"from":([0-9]+),"to":([0-9]+).*/\1 \2/' | sort -n | awk 'NR>1&&$1<=prev{bad=1}{prev=$2}END{print bad?"overlap":"ok"}')" '^ok$'
check bills-reserve-clamped "$(j -b $CA -X POST $B/api/c/bills/reserve -d '{"n":5000}' | js 'r.n')" '^100$'
check bills-reserve-bad-n "$(j -b $CA -X POST $B/api/c/bills/reserve -d '{"n":0}')" 'at least 1'
BILL='{"client_id":"bill-test-000001","date":"2026-10-16","items":[{"name":"Sting","qty":2,"rate":"20"},{"name":"चाय","qty":1.5,"rate":"12.50"}],"customer":"Mehta","phone":"98765 43210","discount":"5","pay_mode":"credit","series":"A","bill_no":4,"collection_client_id":"sale-test-000001"}'
B1=$(j -b $CA -X POST $B/api/c/bills -d "$BILL")
check bills-create "$B1" '"total_paise":5375'
check bills-create-phone "$(echo "$B1" | js 'r.phone')" '^\+919876543210$'
check bills-retry-same-row "$(j -b $CA -X POST $B/api/c/bills -d "$BILL" | js 'r.bill_no')" '^4$'
check bills-number-conflict-reassigned "$(j -b $CA -X POST $B/api/c/bills -d '{"client_id":"bill-test-000002","items":[{"name":"Tea","qty":1,"rate":10}],"series":"A","bill_no":4}' | js 'r.bill_no>4&&r.series')" '^A$'
check bills-server-number "$(j -b $CA -X POST $B/api/c/bills -d '{"client_id":"bill-test-000003","items":[{"name":"Tea","qty":1,"rate":10}]}' | js 'typeof r.bill_no')" 'number'
check bills-provisional-series "$(j -b $CA -X POST $B/api/c/bills -d '{"client_id":"bill-test-000004","items":[{"name":"Tea","qty":1,"rate":10}],"series":"PK7Q2","bill_no":1}' | js 'r.series+r.bill_no')" '^PK7Q21$'
ITEMS=$(printf '{"name":"x","qty":1,"rate":1},%.0s' $(seq 100))'{"name":"x","qty":1,"rate":1}'
check bills-too-many-items "$(j -b $CA -X POST $B/api/c/bills -d "{\"client_id\":\"bill-test-000005\",\"items\":[$ITEMS]}")" 'at most 100'
check bills-bad-phone "$(j -b $CA -X POST $B/api/c/bills -d '{"client_id":"bill-test-000006","items":[{"name":"x","qty":1,"rate":1}],"phone":"12"}')" 'Phone number looks wrong'
check bills-no-client-id "$(j -b $CA -X POST $B/api/c/bills -d '{"items":[{"name":"x","qty":1,"rate":1}]}')" 'client_id is required'
check bills-udhaar-needs-name "$(j -b $CA -X POST $B/api/c/bills -d '{"client_id":"bill-test-000007","items":[{"name":"x","qty":1,"rate":1}],"pay_mode":"credit"}')" 'Udhaar'
check bills-search-name "$(j -b $CA "$B/api/c/bills?q=mehta" | js 'r.total+"/"+r.bills[0].client_id')" '^1/bill-test-000001$'
check bills-search-phone "$(j -b $CA "$B/api/c/bills?q=9876543" | js 'r.total')" '^1$'
check bills-search-number "$(j -b $CA "$B/api/c/bills?q=%234" | js 'r.bills.some(b=>b.client_id==="bill-test-000001")')" '^true$'
check bills-search-wildcards-literal "$(j -b $CA "$B/api/c/bills?q=%25" | js 'r.total')" '^0$'
check bills-search-dates "$(j -b $CA "$B/api/c/bills?from=2026-10-16&to=2026-10-16" | js 'r.total')" '^1$'
check bills-paginate "$(j -b $CA "$B/api/c/bills?limit=2&offset=1" | js 'r.bills.length+"/"+(r.total>2)')" '^2/true$'
check bills-get "$(j -b $CA $B/api/c/bills/bill-test-000001 | js 'r.customer')" '^Mehta$'
check bills-get-missing "$(j -b $CA $B/api/c/bills/nope-nope-nope)" 'Bill not found'
check bills-isolated "$(j -b $T/o "$B/api/c/bills" | js 'r.total')" '^0$'
check bills-in-sync "$(j -b $CA "$B/api/c/sync" | js 'r.tables.bills.upsert.length>=4')" '^true$'
SALE=$(j -b $CA -X POST $B/api/c/collections -d '{"client_id":"sale-test-000001","date":"2026-10-16","amount":"53.75","mode":"credit","customer":"Mehta","notes":"Bill #4"}')
check bills-sale-created "$SALE" '"amount_paise":5375'
check bills-void "$(j -b $CA -X POST $B/api/c/bills/bill-test-000001/void -d '{}' | js 'r.voided')" '^1$'
check bills-void-removed-sale "$(j -b $CA "$B/api/c/collections?from=2026-10-16&to=2026-10-16" | js 'r.some(x=>x.client_id==="sale-test-000001")')" '^false$'
check bills-void-again-ok "$(j -b $CA -X POST $B/api/c/bills/bill-test-000001/void -d '{}' | js 'r.voided')" '^1$'
check bills-void-sale-already-gone "$(j -b $CA -X POST $B/api/c/bills/bill-test-000003/void -d '{}' | js 'r.voided')" '^1$'
check bills-filter-voided "$(j -b $CA "$B/api/c/bills?voided=1" | js 'r.total')" '^2$'
check bills-void-keeps-number "$(j -b $CA -X POST $B/api/c/bills -d '{"client_id":"bill-test-000008","items":[{"name":"x","qty":1,"rate":1}]}' | js 'r.bill_no>4')" '^true$'
check bills-staff-cannot-void "$(j -b $ST -X POST $B/api/c/bills/bill-test-000008/void -d '{}')" 'permission'

echo "All smoke tests passed"
