// App language (English / हिंदी). `t(key, english)` returns the Hindi text when the app is in Hindi and the key is known,
// otherwise the English text, so a missing translation never shows a blank or a raw key.
// Short form: `t('Sales')` uses the English text itself as the key. `{name}` placeholders are filled from `vars`.
// Language order: Settings choice (localStorage.dk_lang) > the phone's language (hi*) > English.
// Only Simple-mode surfaces are translated; admin/Pro-only screens stay in English on purpose.
const HI = {
  // menu, tabs, + sheet
  'Home': 'होम', 'Khata': 'खाता', 'Chat': 'चैट', 'Bill': 'बिल', 'Bills': 'बिल', 'Write': 'लिखो', 'Counter': 'गिनती', 'More': 'और',
  'Add': 'जोड़ें', 'Add entry': 'एंट्री जोड़ें', 'Main': 'मुख्य', 'Quick navigation': 'जल्दी खोलें', 'Open menu': 'मेन्यू खोलें',
  'Today’s khata': 'आज का खाता', 'Chat khata': 'चैट खाता', 'Make a bill': 'बिल बनाओ', 'Past bills': 'पुराने बिल', 'Write expenses': 'खर्चा लिखो',
  'Cash counter': 'नकद गिनती', 'Settings': 'सेटिंग्स', 'Reports': 'रिपोर्ट', 'Udhaar': 'उधार', 'Products': 'माल', 'Photos & bills': 'फोटो और बिल',
  'Download (Excel/PDF)': 'डाउनलोड (Excel/PDF)', 'Team': 'टीम', 'Business': 'कारोबार', 'Account': 'खाता',
  'Bill for a customer': 'ग्राहक का बिल', 'Items, total, share on WhatsApp': 'सामान, कुल, WhatsApp पर भेजो',
  'Sale': 'बिक्री', 'Money you received': 'जो पैसे मिले', 'Money you spent — gas, rent, tea…': 'जो पैसे लगे — गैस, किराया, चाय…',
  'Stock bought': 'माल खरीदा', 'Items you bought to sell': 'बेचने के लिए खरीदा माल',
  'Write or paste notes': 'नोट्स लिखो या पेस्ट करो', 'Many entries at once, the way you talk': 'बोलचाल में, कई एंट्री एक साथ',
  'Photo of a bill or page': 'बिल या पन्ने की फोटो', 'We read it for you': 'हम पढ़ देंगे', 'Uploading photo…': 'फोटो भेज रहे हैं…',
  'Sign out': 'साइन आउट', 'Syncing…': 'सिंक हो रहा है…', 'Saved ✓': 'सेव हो गया ✓', 'Saved': 'सेव हो गया',
  'Appearance': 'दिखावट', 'Change mode': 'मोड बदलो', 'Main menu': 'मुख्य मेन्यू',
  'Sign in to sync': 'सिंक के लिए साइन इन करें', 'Offline': 'ऑफ़लाइन', 'Synced': 'सिंक हो गया', 'Sync problem': 'सिंक में दिक्कत',
  // modes
  'Simple': 'आसान', 'Standard': 'स्टैंडर्ड', 'Pro': 'प्रो', 'Recommended': 'सुझाया गया', 'For owners': 'मालिकों के लिए', 'Everything': 'सब कुछ',
  'Add sales and expenses, make bills, count cash. Nothing else on screen.': 'बिक्री और खर्चा लिखो, बिल बनाओ, नकद गिनो। स्क्रीन पर और कुछ नहीं।',
  'Adds reports, udhaar, products, photos, stock and cash closing.': 'रिपोर्ट, उधार, माल, फोटो, स्टॉक और नकद मिलान जुड़ जाते हैं।',
  'All numbers and controls, including the audit log.': 'सारे नंबर और कंट्रोल, ऑडिट लॉग समेत।',
  'How do you want to use DailyKhata?': 'DailyKhata कैसे इस्तेमाल करना है?',
  'You can change this any time. Your data is the same in every mode.': 'इसे कभी भी बदल सकते हैं। हर मोड में आपका डेटा वही रहता है।',
  'Welcome! Pick your style': 'स्वागत है! अपना तरीका चुनो',
  'New to apps like this? Choose Layman — you can switch later in Settings.': 'ऐसे ऐप पहली बार? “आसान” चुनो — बाद में सेटिंग्स में बदल सकते हो।',
  'Experience mode': 'इस्तेमाल का मोड',
  // Home / quick add
  'Bought stock': 'माल खरीदा', 'Money received': 'पैसे मिले', 'Items for the shop': 'दुकान का माल', 'Gas, rent, wifi…': 'गैस, किराया, वाईफाई…',
  'Sales': 'बिक्री', 'Bought': 'खरीदा', 'Expenses': 'खर्चा', 'Spent': 'खर्च', 'Profit': 'मुनाफ़ा', 'Cash left': 'नकद बचा', 'Checks': 'जाँच',
  'Today': 'आज', 'Yesterday': 'कल', 'Hi {name}': 'नमस्ते {name}', 'Quick add': 'जल्दी जोड़ो', 'What happened in the shop?': 'दुकान में क्या हुआ?',
  'You can view this shop but not add entries.': 'आप इस दुकान को देख सकते हो, एंट्री नहीं जोड़ सकते।',
  'Amount in rupees': 'रुपये में रकम', 'Customer name (optional)': 'ग्राहक का नाम (ज़रूरी नहीं)', 'How was it paid?': 'पैसे कैसे मिले?',
  'Cash': 'नकद', 'UPI': 'UPI', 'Card': 'कार्ड', 'Save sale': 'बिक्री सेव करो', 'Save expense': 'खर्चा सेव करो', 'Save purchase': 'खरीद सेव करो',
  'What was it for?': 'किसलिए था?', 'Or type what it was for': 'या लिखो किसलिए था', 'What did you buy?': 'क्या खरीदा?', 'Item name, e.g. Sting': 'सामान का नाम, जैसे स्टिंग',
  'How many boxes / packs?': 'कितने डिब्बे / पैक?', 'Less': 'कम', 'Enter the total you paid in the big box above.': 'जितना दिया, वो कुल रकम ऊपर बड़े डिब्बे में डालो।',
  'Enter the amount first': 'पहले रकम डालो', 'Tap what the expense was for': 'खर्चा किसलिए था, उस पर टैप करो', 'Tell us which item you bought': 'बताओ कौन सा माल खरीदा',
  'Udhaar sale': 'उधार बिक्री', 'Added today': 'आज जोड़ा', 'Added': 'जोड़ा', 'See my day': 'मेरा दिन देखो', 'Full day view': 'पूरा दिन',
  'For a customer': 'ग्राहक के लिए', 'Reprint, udhaar reminders': 'दोबारा छापो, उधार याद दिलाओ', 'Paste notes': 'नोट्स पेस्ट करो', 'Many at once': 'कई एक साथ',
  'Jot lines, auto total': 'लाइनें लिखो, कुल अपने-आप', 'Nice! You have added all three kinds of entry.': 'बहुत बढ़िया! तीनों तरह की एंट्री जोड़ दीं।',
  'New here? ': 'नए हो? ', 'Pick Sale, type the amount, tap Save.': 'बिक्री चुनो, रकम डालो, सेव दबाओ।', 'Done': 'हो गया', 'Hide': 'छिपाओ',
  'Scan my handwritten hisaab': 'मेरा हाथ का हिसाब स्कैन करो', 'Expense': 'खर्चा',
  // Today's khata
  'Choose date': 'तारीख चुनो', 'Previous day': 'पिछला दिन', 'Next day': 'अगला दिन', 'Day strip': 'दिन की पर्ची', 'KHATA': 'खाता',
  'Nothing written yet. Tap + Sale to start the strip.': 'अभी कुछ नहीं लिखा। पर्ची शुरू करने के लिए + बिक्री दबाओ।', 'Nothing written yet.': 'अभी कुछ नहीं लिखा।',
  'Out': 'गया', 'In': 'आया', 'Cash in drawer': 'गल्ले में नकद', 'Profit for the day': 'दिन का मुनाफ़ा', 'Net profit': 'शुद्ध मुनाफ़ा', 'Close the day': 'दिन बंद करो',
  'Delete': 'हटाओ', 'Deleted': 'हटा दिया', 'Delete this entry? This is recorded in the audit log.': 'यह एंट्री हटानी है? यह ऑडिट लॉग में दर्ज होगा।',
  'Save changes': 'बदलाव सेव करो', 'Add purchase': 'खरीद जोड़ो', 'Edit purchase': 'खरीद बदलो', 'Add expense': 'खर्चा जोड़ो', 'Edit expense': 'खर्चा बदलो',
  'Add collection': 'बिक्री जोड़ो', 'Edit collection': 'बिक्री बदलो', 'Item': 'सामान', 'Quantity': 'मात्रा', 'Unit': 'यूनिट', 'Total cost ₹': 'कुल दाम ₹', 'Paid by': 'भुगतान',
  'Supplier': 'सप्लायर', 'Notes': 'नोट', 'Category': 'खर्चे की किस्म', 'Amount ₹': 'रकम ₹', 'Date': 'तारीख', 'Mode': 'तरीका', 'Customer': 'ग्राहक',
  'Udhaar (credit sale)': 'उधार (बिक्री)', 'Opening cash': 'सुबह का नकद', 'Expected in drawer': 'गल्ले में होना चाहिए', 'Counted': 'गिना', 'Difference': 'फ़र्क़',
  'Books match ✓': 'हिसाब मिल गया ✓', 'Short by ': 'कम है ', 'Over by ': 'ज़्यादा है ', 'Expected ': 'होना चाहिए ', 'Close day': 'दिन बंद करो', 'Update cash count': 'नकद गिनती बदलो',
  'Opening cash ₹': 'सुबह का नकद ₹', 'Cash counted now ₹': 'अभी गिना नकद ₹', 'Enter the cash you counted': 'जो नकद गिना वो डालो', 'Cash closing saved': 'नकद मिलान सेव हो गया',
  'Hisaab text': 'हिसाब का लेख', 'Read entries': 'एंट्री पढ़ो', 'Scan photo': 'फोटो स्कैन करो', 'Type or paste hisaab': 'हिसाब लिखो या पेस्ट करो',
  // counter
  'Switch language': 'भाषा बदलो', 'Tap a note or coin to start': 'शुरू करने के लिए नोट या सिक्के पर टैप करो', 'Count some notes first': 'पहले कुछ नोट गिनो',
  'Total cash ': 'कुल नकद ', 'Share receipt': 'रसीद भेजो', 'Save…': 'सेव…', 'Tap a note or coin — the total adds itself': 'नोट या सिक्के पर टैप करो — कुल अपने-आप जुड़ेगा',
  'Add as today’s sale (cash)': 'आज की नकद बिक्री में जोड़ो', 'Money received in the shop': 'दुकान में मिले पैसे', 'Use as closing cash': 'दिन के अंत का नकद बनाओ',
  'Cash counted in the drawer today': 'आज गल्ले में गिना नकद', 'Cash report': 'नकद रिपोर्ट', 'TOTAL CASH': 'कुल नकद', 'Clear': 'साफ़ करो',
  // bill
  'You can view this shop but not make bills.': 'आप इस दुकान को देख सकते हो, बिल नहीं बना सकते।', 'New bill': 'नया बिल', 'Add items to start': 'शुरू करने के लिए सामान जोड़ो',
  'Item name': 'सामान का नाम', 'Rate': 'भाव', 'Rate in rupees': 'रुपये में भाव', 'Remove item': 'सामान हटाओ', 'Tap an item below, or add one.': 'नीचे से सामान चुनो, या नया जोड़ो।',
  'Customer name': 'ग्राहक का नाम', 'Phone': 'फ़ोन', 'Customer phone': 'ग्राहक का फ़ोन', 'Discount in rupees': 'छूट (रुपये में)', 'Discount': 'छूट',
  'Payment due (udhaar)': 'बाकी पैसे (उधार)', 'TOTAL': 'कुल', 'Share bill': 'बिल भेजो', 'Save & share bill': 'बिल सेव करो और भेजो', 'Add at least one item with a rate': 'कम से कम एक सामान भाव के साथ जोड़ो',
  'Udhaar needs the customer’s name': 'उधार के लिए ग्राहक का नाम चाहिए', 'Start a new bill? This one is not saved.': 'नया बिल शुरू करें? यह वाला सेव नहीं है।',
  'Items': 'सामान', 'Add item': 'सामान जोड़ो', 'Discount ₹': 'छूट ₹', 'Total': 'कुल', 'Preview': 'झलक', 'Thank you, visit again!': 'धन्यवाद, फिर आइए!',
  // chat
  'Message': 'संदेश', 'Send': 'भेजो', 'Speak': 'बोलो', 'Type what happened…': 'जो हुआ वो लिखो…', 'Today’s total': 'आज का कुल', 'Count cash': 'नकद गिनो', 'Help': 'मदद',
  'Edit': 'बदलो', 'Deleted. ': 'हटा दिया। ', 'Updated. ': 'बदल दिया। ', 'Earlier days': 'पिछले दिन', 'No earlier entries': 'इससे पहले कुछ नहीं', '{n} entries': '{n} एंट्री', 'Nothing was written for {date}.': '{date} को कुछ नहीं लिखा गया।', '{date}:': '{date}:', 'You don’t have access to udhaar totals.': 'उधार का टोटल देखने की इजाज़त नहीं है।', 'Open udhaar list': 'उधार की लिस्ट खोलो', 'No udhaar pending. 🎉': 'कोई उधार बाकी नहीं। 🎉', 'Udhaar to collect: {amt} from {n} customers': 'उधार वसूलना है: {amt}, {n} ग्राहकों से', '+{n} more': '+{n} और', 'No udhaar found for “{name}”.': '“{name}” का कोई उधार नहीं मिला।', '{name} owes you {amt}': '{name} का {amt} बाकी है', 'You owe {name} {amt}': 'आपको {name} को {amt} देना है', 'Matches for “{name}”:': '“{name}” से मिलते नाम:', 'You just sent this. Add it again?': 'अभी यही भेजा था। फिर से जोड़ें?', 'Add again': 'फिर जोड़ो', 'Long message: only the first {n} characters were used': 'मैसेज लंबा है: सिर्फ़ पहले {n} अक्षर लिए गए', 'Voice needs the internet. You can type instead.': 'बोलने के लिए इंटरनेट चाहिए। आप लिख सकते हैं।', 'Voice is not available here': 'यहाँ बोलकर लिखना नहीं चल सकता', 'Didn’t hear anything. Tap the mic and try again.': 'कुछ सुनाई नहीं दिया। माइक दबाकर फिर बोलो।', 'Voice did not work. You can type instead.': 'बोलना नहीं चला। आप लिख सकते हैं।', 'Undo last': 'पिछला वापस',
  'Undo': 'वापस', 'Removed. ': 'हटा दिया। ', 'So far today:': 'आज अब तक:', 'Today so far:': 'आज अब तक:', 'Open khata': 'खाता खोलो', 'How do I use this?': 'इसे कैसे इस्तेमाल करूँ?',
  'Namaste{name}! Tell me what happened — like ': 'नमस्ते{name}! बताओ क्या हुआ — जैसे ', ' or ': ' या ', '. I’ll write it in your khata.': '। मैं आपके खाते में लिख दूँगा।',
  'Just write it the way you talk:': 'जैसे बोलते हो वैसे लिखो:', 'Let’s make a bill.': 'चलो बिल बनाते हैं।', 'Count the notes in the drawer:': 'गल्ले के नोट गिनो:',
  'I couldn’t find an amount there. Put the amount next to what it was for, like “gas 820”.': 'वहाँ रकम नहीं मिली। जिसके लिए था उसके साथ रकम लिखो, जैसे “गैस 820”।',
  'Show examples': 'उदाहरण दिखाओ', 'Sales ': 'बिक्री ', 'Spent ': 'खर्च ', 'Allow the microphone to speak entries': 'बोलकर एंट्री करने के लिए माइक की इजाज़त दो',
  // write expenses
  'Your notes': 'आपके नोट्स', 'Date for these entries': 'इन एंट्री की तारीख', 'Found': 'मिला', 'Nothing yet': 'अभी कुछ नहीं', 'Start typing': 'लिखना शुरू करो', 'Add to khata': 'खाते में जोड़ो',
  'Read with AI': 'AI से पढ़ाओ', 'Undo AI': 'AI वापस', 'Include this': 'इसे जोड़ो', 'Money in': 'पैसे आए', 'Try an example': 'उदाहरण देखो',
  'Write the way you talk. One thing per line, or all in one go:': 'जैसे बोलते हो वैसे लिखो। एक लाइन में एक बात, या सब एक साथ:',
  'Type or paste anything — the money is picked out for you': 'कुछ भी लिखो या पेस्ट करो — पैसे हम निकाल लेंगे', 'Give every ticked item a name': 'हर चुने सामान को नाम दो',
  'See khata →': 'खाता देखो →', 'Type or paste anything…': 'कुछ भी लिखो या पेस्ट करो…', 'Type some lines first': 'पहले कुछ लाइनें लिखो',
  // bills list
  'All': 'सभी', 'Udhaar due': 'उधार बाकी', 'Paid': 'चुकाया', 'Voided': 'रद्द', 'Walk-in customer': 'आम ग्राहक', 'No bills match.': 'कोई बिल नहीं मिला।',
  'No bills yet. Bills you make from “Make a bill” show up here.': 'अभी कोई बिल नहीं। “बिल बनाओ” से बने बिल यहाँ दिखेंगे।', 'Loading…': 'लोड हो रहा है…', 'Load more': 'और दिखाओ',
  'Bill total': 'बिल का कुल', 'Void bill': 'बिल रद्द करो', 'Reprint / share': 'दोबारा छापो / भेजो', 'Send udhaar reminder': 'उधार की याद भेजो', 'Mark paid': 'चुकाया मार्क करो',
  'Mark as paid': 'चुकाया मार्क करो', 'Open WhatsApp': 'WhatsApp खोलो', 'Customer’s phone': 'ग्राहक का फ़ोन', 'Search name, phone, bill number': 'नाम, फ़ोन, बिल नंबर खोजो',
  'Search bills': 'बिल खोजो', 'Customers owe you': 'ग्राहकों पर बकाया', 'Past bills, reprint and reminders': 'पुराने बिल, दोबारा छापो और याद दिलाओ', 'Could not load bills': 'बिल लोड नहीं हुए',
  'That does not look like a phone number': 'यह फ़ोन नंबर जैसा नहीं लगता', 'No item details saved.': 'सामान की जानकारी सेव नहीं है।', 'VOIDED bill': 'रद्द किया बिल',
  'Paid (udhaar settled)': 'चुकाया (उधार पूरा)', 'Customer phone number': 'ग्राहक का फ़ोन नंबर', 'How did they pay': 'कैसे चुकाया', 'Bank': 'बैंक',
  // settings
  'Photos': 'फोटो', 'Download': 'डाउनलोड', 'Today · {n} entries': 'आज · {n} एंट्री', '+{n} earlier': '+{n} पुरानी', 'Added {n} entries': '{n} एंट्री जोड़ी',
  'Bill #{no} marked paid': 'बिल #{no} चुकाया मार्क हुआ', 'Bill #{no} voided': 'बिल #{no} रद्द हुआ',
  'Choose your language': 'अपनी भाषा चुनो', 'Hindi or English. Saved on this device.': 'हिंदी या English। इस फ़ोन में सेव रहता है।',
  'Money in · UPI': 'पैसे आए · UPI', 'Money in · Card': 'पैसे आए · कार्ड', 'Expense · UPI/bank': 'खर्चा · UPI/बैंक', 'Expense · udhaar': 'खर्चा · उधार', 'Name': 'नाम', 'Stock': 'माल', 'pcs': 'पीस',
  'Language / भाषा': 'भाषा / Language', ' — add many entries at once': ' — कई एंट्री एक साथ', 'What for': 'किसलिए', 'Showing {n}': '{n} दिख रहे हैं', 'Showing {n} of {total}': '{total} में से {n} दिख रहे हैं', 'Language': 'भाषा', 'App language': 'ऐप की भाषा', 'English': 'English', 'हिंदी': 'हिंदी', 'Saved on this device.': 'इस फ़ोन में सेव है।',
  'Experience': 'इस्तेमाल का तरीका', 'System': 'सिस्टम', 'Light': 'हल्का', 'Dark': 'गहरा', 'Style': 'स्टाइल', 'Clean': 'सादा', 'Soft': 'नरम', 'Audit log': 'बदलावों का रिकॉर्ड', 'Every change to accounts, stock, team and settings: who, when and what.': 'हिसाब, स्टॉक, टीम और सेटिंग्स का हर बदलाव: किसने, कब और क्या।', 'Download reports': 'रिपोर्ट डाउनलोड करें', 'Excel or PDF for your records or your accountant': 'अपने रिकॉर्ड या अकाउंटेंट के लिए Excel या PDF', 'Photos of your handwritten hisaab, supplier bills or receipts. Only your shop can see them.': 'हाथ से लिखे हिसाब, सप्लायर के बिल या रसीदों की फ़ोटो। इन्हें सिर्फ़ आपकी दुकान देख सकती है।', 'Add a sale or expense right on Home': 'होम पर ही बिक्री या खर्च जोड़ें', 'Shortcuts': 'शॉर्टकट', 'Big buttons for everything you use': 'आपके काम की हर चीज़ के बड़े बटन', 'Today first': 'पहले आज का हिसाब', 'Today’s money and entries at the top': 'आज का पैसा और एंट्री सबसे ऊपर', 'One button': 'एक बटन', 'Today’s total and one Add button': 'आज का कुल और एक जोड़ें बटन', 'Khata strip': 'खाता पर्ची', 'Today’s khata is your Home': 'आज का खाता ही आपका होम', 'Type or speak what happened': 'जो हुआ लिखें या बोलें', 'Greeting and date': 'नमस्ते और तारीख़', 'Today’s totals': 'आज का कुल', 'Add form (sale, stock, expense)': 'जोड़ने का फ़ॉर्म (बिक्री, माल, खर्च)', 'Big Add button': 'बड़ा जोड़ें बटन', 'Count the drawer': 'गल्ले की गिनती', 'Every entry today': 'आज की हर एंट्री', 'Type or speak': 'लिखें या बोलें', 'Who owes what': 'किसका कितना बाकी', 'Sales and profit': 'बिक्री और मुनाफ़ा', 'Scan hisaab': 'हिसाब स्कैन करें', 'Photo of a page': 'पन्ने की फ़ोटो', 'Nothing is switched on for Home.': 'होम पर अभी कुछ भी चालू नहीं है।', 'Choose what Home shows': 'चुनें कि होम पर क्या दिखे', 'Move up': 'ऊपर करें', 'Move down': 'नीचे करें', 'Pick how Home looks, then choose what it shows. Saved on this device.': 'होम कैसा दिखे यह चुनें, फिर उस पर क्या दिखे। इसी फ़ोन पर सेव होता है।', 'What Home shows': 'होम पर क्या दिखे', 'Back to the usual Home': 'होम पहले जैसा हो गया', 'Reset this layout': 'यह लेआउट पहले जैसा करें', 'See Home': 'होम देखें', 'Chat: type or speak what happened, like messaging a friend. It goes straight into your khata.': 'चैट: जो हुआ वह लिखें या बोलें, जैसे किसी दोस्त को मैसेज करते हैं। सीधे आपके खाते में जाता है।', 'Khata strip: Home opens today’s khata, with every entry and the cash in the drawer.': 'खाता पर्ची: होम पर आज का खाता खुलता है, हर एंट्री और गल्ले के पैसे के साथ।', 'Nothing added today yet. Tap + to add the first entry.': 'आज अभी कुछ नहीं जोड़ा। पहली एंट्री के लिए + दबाएँ।', 'Edit stock bought': 'खरीदा माल बदलें', 'Add stock bought': 'खरीदा माल जोड़ें', 'Edit sale': 'बिक्री बदलें', 'Add sale': 'बिक्री जोड़ें', 'Udhaar (credit)': 'उधार', 'Type the name exactly as on the udhaar entry, so the right balance goes down.': 'नाम ठीक वैसा ही लिखें जैसा उधार की एंट्री में है, ताकि सही बकाया कम हो।', 'Hisaab page': 'हिसाब का पन्ना', 'Supplier bill': 'सप्लायर का बिल', 'Expense receipt': 'खर्च की रसीद', 'Other': 'और कुछ', 'Nothing chosen yet': 'अभी कुछ नहीं चुना', 'Take or choose a photo': 'फ़ोटो लें या चुनें', 'Upload': 'अपलोड करें', 'Choose a photo first': 'पहले फ़ोटो चुनें', 'Uploaded': 'अपलोड हो गया', 'Photo or PDF': 'फ़ोटो या PDF', 'Type': 'किस्म', 'Choose how much of DailyKhata you want to see. Your data is the same in every mode.': 'DailyKhata में कितना कुछ दिखे, यह चुनें। हर तरीके में आपका हिसाब एक जैसा रहता है।', 'Receipt': 'रसीद', '{n} on': '{n} चालू', 'New category, e.g. Electricity': 'नई कैटेगरी, जैसे बिजली', 'New category': 'नई कैटेगरी', 'Rename': 'नाम बदलें', 'Rename category': 'कैटेगरी का नाम बदलें', 'Delete “{name}”?': '“{name}” हटाएँ?', 'Add a rate for {name}': '{name} का रेट डालें', 'Type what the item is': 'सामान का नाम लिखें', 'Bill #{no} saved as a sale': 'बिल #{no} बिक्री में सेव हो गया', 'Removed': 'हटा दिया', 'Classic': 'क्लासिक', 'Torn paper slip in your colour': 'आपके रंग में फटी पर्ची जैसी', 'Shop printer': 'दुकान का प्रिंटर', 'Looks like a printed till slip': 'छपी हुई रसीद जैसी', 'Paper & ink': 'कागज़ और स्याही', 'Oat paper, serif, dotted lines': 'हल्का कागज़, सुंदर अक्षर, बिंदु वाली लाइनें', 'Modern': 'मॉडर्न', 'Clean card with a colour band': 'रंगीन पट्टी वाला साफ़ कार्ड', 'Invoice': 'इनवॉइस', 'Formal: item table and signature': 'औपचारिक: सामान की टेबल और दस्तख़त', 'Bold': 'बोल्ड', 'The total first, big, on your colour': 'कुल रकम सबसे ऊपर, बड़ी, आपके रंग पर', 'Receipts': 'रसीदें', 'Receipt design': 'रसीद का डिज़ाइन', 'receipt': 'रसीद', 'Pick how shared bills, cash reports and notes look. Saved on this device.': 'भेजे गए बिल, नकद रिपोर्ट और नोट्स कैसे दिखें, यह चुनें। इसी फ़ोन पर सेव होता है।', 'Thank-you line': 'धन्यवाद वाली लाइन', 'Printed at the bottom of bills. Leave it empty for none.': 'बिल के नीचे छपती है। नहीं चाहिए तो खाली छोड़ दें।', 'See a sample': 'नमूना देखें', 'BILL TO': 'ग्राहक', 'ITEM': 'सामान', 'QTY': 'मात्रा', 'RATE': 'रेट', 'AMOUNT': 'रकम', 'Amount in words': 'शब्दों में रकम', 'For': 'की ओर से', 'Authorised signatory': 'अधिकृत हस्ताक्षर', 'Send to customer on WhatsApp': 'ग्राहक को WhatsApp पर भेजें', 'Preparing receipt…': 'रसीद बन रही है…', 'Saved to your downloads': 'डाउनलोड में सेव हो गया', 'Share image': 'फ़ोटो भेजें', 'Save image': 'फ़ोटो सेव करें', 'Send as text instead': 'इसकी जगह टेक्स्ट भेजें', 'Could not open sharing': 'भेजना नहीं खुल सका', 'Could not create the receipt': 'रसीद नहीं बन सकी', 'Basics': 'सादे', 'Art styles': 'कला वाले स्टाइल', 'Mix of all': 'सबका मेल', 'Changes only how the app looks. Your data stays the same. Saved on this device.': 'सिर्फ़ ऐप का रूप बदलता है। आपका हिसाब वैसा ही रहता है। इसी फ़ोन पर सेव होता है।', 'Your style has its own colours, so Light and Dark do not change it. Pick Clean, Bento or Neumorphism to use them.': 'आपके स्टाइल के अपने रंग हैं, इसलिए हल्का और गहरा इसे नहीं बदलते। इनके लिए सादा, Bento या Neumorphism चुनें।', 'Home screen': 'होम स्क्रीन', 'Buttons': 'बटन',
  'Company name': 'दुकान का नाम', 'Business type': 'कारोबार की किस्म', 'Email': 'ईमेल', 'Address': 'पता', 'Business details': 'दुकान की जानकारी', 'Change password': 'पासवर्ड बदलो',
  'My account': 'मेरा खाता', 'Current password': 'अभी का पासवर्ड', 'New password': 'नया पासवर्ड', 'Appearance, branding and your account': 'दिखावट, दुकान की पहचान और आपका खाता',
  'Save branding & details': 'जानकारी सेव करो', 'Expense categories': 'खर्चे की किस्में', 'Add your logo': 'लोगो जोड़ो', 'Change logo': 'लोगो बदलो', 'Remove logo': 'लोगो हटाओ',
};

const KEY = 'dk_lang';
let current = null;
const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };

/** 'hi' or 'en': the saved choice, else the phone's language, else English. */
export function lang() {
  if (current) return current;
  const saved = read(KEY);
  current = saved === 'hi' || saved === 'en' ? saved : (typeof navigator !== 'undefined' && /^hi\b/i.test(navigator.language || '') ? 'hi' : 'en');
  return current;
}
export const isHindi = () => lang() === 'hi';
/** Choose the language, remember it, update <html lang> and tell the app to repaint. */
export function setLang(l) {
  current = l === 'hi' ? 'hi' : 'en';
  try { localStorage.setItem(KEY, current); } catch { /* storage blocked: lasts until reload */ }
  applyLangAttr();
  window.dispatchEvent(new Event('langchange'));
}
export function applyLangAttr() { if (typeof document !== 'undefined') document.documentElement.lang = lang(); }

/** t('Sales') or t('key', 'English text') or t('Hi {name}', null, { name }). */
export function t(key, english, vars) {
  const en = english ?? key;
  let s = lang() === 'hi' && Object.prototype.hasOwnProperty.call(HI, key) ? HI[key] : en;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? m : String(vars[k])));
  return s;
}
/** Locale for dates and numbers. */
export const locale = () => (lang() === 'hi' ? 'hi-IN' : 'en-IN');
export const HI_KEYS = HI; // for the completeness test
