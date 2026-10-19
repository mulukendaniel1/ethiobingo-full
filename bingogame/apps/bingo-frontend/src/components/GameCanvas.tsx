//apps\bingo-frontend\src\components\GameCanvas.tsx
import { createSignal, onMount, onCleanup, For, Show, createMemo, createEffect, batch } from 'solid-js';
import { jwtDecode } from 'jwt-decode';
import { twMerge } from 'tailwind-merge';
import { Howl, Howler } from 'howler';
import WinnerPopup from './WinnerPopup';
import { showToast } from './Toast';
import BallBoard from './BallBoard';
import UserCard from './UserCard';
import SessionExpiredBanner from './SessionExpiredBanner';
import DuplicateSessionPopup from './DuplicateSessionPopup';
import SessionExpiredPopup from './SessionExpiredPopup';
import NetworkPopup from './NetworkPopup';
import SelectionView from './SelectionView';
import { preloadAllCards, getCachedCard, ensureCardsLoaded } from '../services/cardCache';
import BottomNav from './BottomNav';
import WalletPopup from './WalletPopup';
import InvitePopup from './InvitePopup';
import SettingsView from './SettingsView';
import HistoryView from './HistoryView';
import LeaderboardView from './LeaderboardView';
import ProfileView from './ProfileView';
import ShamoPopup from './ShamoPopup';
import ShamoBadge from './ShamoBadge';
const translations = {
  en: {
    nav: {
      game: 'Game',
      history: 'History',
      leaderboard: 'Leaderboard',
      profile: 'Profile',
      settings: 'Settings',
      deposit: 'Deposit',   // <-- add this for all languages
    },
    wallet: {
      title: 'My Wallet',
      balance_etb: 'Game Balance (ETB)',
      balance_main: 'Main Balance (ETB)',
      deposit: 'Deposit',
      withdraw: 'Withdraw',
    },
    invite: {
      title: 'Invite Friends',
      code: 'Your Referral Code',
      referrals: 'Referrals',
      earnings: 'Earnings',
      copy_link: 'Copy Link',
      share: 'Share',
      recent_commissions: 'Recent Commissions',
      copied: 'Link copied!',
    },
    settings: {
      title: 'Settings',
      updated: 'Language updated!',
      save: 'Save Changes',
      night_mode: 'Night Mode',
      language: 'Language',
      sound: 'Sound',
      muted: 'Muted',
      enabled: 'Enabled',
      tap_to_enable: 'Tap to enable',
      tap_to_mute: 'Tap to mute',
      rules_title: '🏆 Game Rules',
    },
    shamo: {
      badge_label: 'ሻሞ Giveaway',
      title: 'SHA MO',
      subtitle: 'EVERY DAY AT 9:00 PM',
      next_in: 'Next ሻሞ starts in',
      hours: 'HOURS',
      minutes: 'MINUTES',
      seconds: 'SECONDS',
      pick_title: 'Pick a Mystery Box',
      pick_hint: 'Once ሻሞ opens, click on the gift boxes',
      claim_button: 'Open Box',
      claimed: 'Claimed',
      prize_line: '50 ETB per box · locked bonus',
      boxes_opened: 'boxes opened',
      not_active: 'ሻሞ is not active right now.',
      need_deposit: 'You need a confirmed deposit in the last 7 days.',
      cooldown: 'One ሻሞ prize every 24 hours.',
      already_claimed: 'You already claimed this round.',
      button_taken: 'That box was just taken. Pick another.',
      claim_failed: 'Claim failed, please retry.',
      won: '🎉 You won 50 ETB (locked bonus)!',
      started: 'ሻሞ started! Tap the gift boxes.',
      ended: 'ሻሞ round ended. Thanks for playing!',
    },
    rules: {
      card_selection: 'Card Selection',
      card_selection_desc: 'Pick a card during the 30‑second selection window. Each card is 10 ETB. You may sell your card for a refund before the game begins.',
      gameplay: 'Gameplay',
      gameplay_desc: 'Numbers 1–75 are drawn each second. Tap any matching number on your card to mark it.',
      win_conditions: 'Win Conditions',
      win_conditions_desc: 'Complete a horizontal row, vertical column, main diagonal, anti‑diagonal, or all four corners.',
      claiming: 'Claiming Prize',
      claiming_desc: 'Hit the BINGO! button when you’ve completed a valid pattern. The prize pool (minus 10% house edge) is split among all valid winners.',
      penalty: 'Penalty',
      penalty_desc: 'False claims ban you for the current round. Repeated false claims may lead to a permanent ban.',
    },
    common: { close: 'Close', back: 'Back' },
  },
  am: {
     nav: {
      game: 'ጨዋታ',
      history: 'ታሪክ',
      leaderboard: 'መሪ ሰንጠረዥ',
      profile: 'መገለጫ',
      settings: 'ቅንብሮች',
      deposit: 'ብር አስገባ',   // <-- add
    },
    wallet: {
      title: 'የኔ ቦርሳ',
      balance_etb: 'የጨዋታ ሂሳብ (ETB)',
      balance_main: 'ዋና ሂሳብ (ETB)',
      deposit: 'ብር አስገባ',
      withdraw: 'ብር አውጣ',
    },
    invite: {
      title: 'ጓደኞችን ጋብዝ',
      code: 'የማጣቀሻ ኮድ',
      referrals: 'የተጋበዙ',
      earnings: 'ገቢ',
      copy_link: 'ሊንክ ቅዳ',
      share: 'አጋራ',
      recent_commissions: 'በቅርብ የተገኙ ኮሚሽኖች',
      copied: 'ሊንክ ተቀድቷል!',
    },
    settings: {
      title: 'ቅንብሮች',
      updated: 'ቋንቋ ተቀይሯል!',
      save: 'አስቀምጥ',
      night_mode: 'ሌሊት ሁነታ',
      language: 'ቋንቋ',
      sound: 'ድምጽ',
      muted: 'ድምጽ ጠፍቷል',
      enabled: 'ነቃ',
      tap_to_enable: 'ለማንቃት ይንኩ',
      tap_to_mute: 'ለማጥፋት ይንኩ',
      rules_title: '🏆 የጨዋታ ህጎች',
    },
    shamo: {
      badge_label: 'የሻሞ ስጦታ',
      title: 'SHA MO',
      subtitle: 'በየቀኑ ምሽት 3:00',
      next_in: 'ቀጣዩ ሻሞ የሚጀምረው በ',
      hours: 'ሰዓት',
      minutes: 'ደቂቃ',
      seconds: 'ሰከንድ',
      pick_title: 'የምስጢር ሳጥን ይምረጡ',
      pick_hint: 'ሻሞ ሲከፈት የስጦታ ሳጥኖቹን ይጫኑ',
      claim_button: 'ሳጥን ክፈት',
      claimed: 'ተወስዷል',
      prize_line: 'በአንድ ሳጥን 50 ብር · የተቆለፈ ጉርሻ',
      boxes_opened: 'ሳጥኖች ተከፍተዋል',
      not_active: 'ሻሞ አሁን ንቁ አይደለም።',
      need_deposit: 'ባለፉት 7 ቀናት ውስጥ የተረጋገጠ ገንዘብ ማስገባት ያስፈልግዎታል።',
      cooldown: 'በ24 ሰዓት አንድ ጊዜ ብቻ ሻሞ ሽልማት።',
      already_claimed: 'በዚህ ዙር አስቀድመው ተረክበዋል።',
      button_taken: 'ይህ ሳጥን ተወስዷል። ሌላ ይምረጡ።',
      claim_failed: 'መውሰድ አልተሳካም፣ እንደገና ይሞክሩ።',
      won: '🎉 50 ብር አሸንፈዋል (የተቆለፈ ጉርሻ)!',
      started: 'ሻሞ ተጀመረ! የስጦታ ሳጥኖቹን ይጫኑ።',
      ended: 'የሻሞ ዙር አብቅቷል። ስለተጫወቱ እናመሰግናለን!',
    },
    rules: {
      card_selection: 'ካርድ መምረጥ',
      card_selection_desc: 'በ30 ሰከንድ የምርጫ መስኮት ውስጥ አንድ ካርድ ይምረጡ። እያንዳንዱ ካርድ 10 ETB ነው። ጨዋታ ከመጀመሩ በፊት ካርድዎን ሸጠው ገንዘብዎን መመለስ ይችላሉ።',
      gameplay: 'የጨዋታ ሂደት',
      gameplay_desc: 'ከ1 እስከ 75 ያሉ ቁጥሮች በየሰከንዱ ይወጣሉ። በካርድዎ ላይ ካለው ቁጥር ጋር የሚዛመደውን ቁጥር ለማርክ ማድረግ ይንኩ።',
      win_conditions: 'የማሸነፊያ ሁኔታዎች',
      win_conditions_desc: 'ሙሉ ረድፍ፣ ሙሉ አምድ፣ ዋና ዲያጎን፣ ተቃራኒ ዲያጎን ወይም አራቱንም ማዕዘኖች ያጠናቅቁ።',
      claiming: 'ሽልማት ማግኘት',
      claiming_desc: 'ትክክለኛ ቅጥ ሲያጠናቅቁ "BINGO!" የሚለውን ቁልፍ ይጫኑ። ሽልማቱ (ከ10% ኮሚሽን በኋላ) በሁሉም አሸናፊዎች መካከል ይከፈላል።',
      penalty: 'ቅጣት',
      penalty_desc: 'የውሸት ጥያቄ ለዚያ ዙር ያግዳል። ተደጋጋሚ የውሸት ጥያቄዎች ወደ ቋሚ እገዳ ሊመሩ ይችላሉ።',
    },
    common: { close: 'ዝጋ', back: 'ተመለስ' },
  },
  ti: {
    nav: {
      game: 'ጸወታ',
      history: 'ታሪኽ',
      leaderboard: 'መራሒ ሰንጠረዥ',
      profile: 'መገለጺ',
      settings: 'ኣቀማምጣ',
      deposit: 'ኣእቱ',        // <-- add
    },
    wallet: {
      title: 'ቦርሳይ',
      balance_etb: 'ናይ ጸወታ ሒሳብ (ETB)',
      balance_main: 'ቀንዲ ሒሳብ (ETB)',
      deposit: 'ኣእቱ',
      withdraw: 'ኣውጻ',
    },
    invite: {
      title: 'ኣዕድም ኣብዓል',
      code: 'ኮድ ምዕዳም',
      referrals: 'ዝተዓደሙ',
      earnings: 'ምርኮታት',
      copy_link: 'ሊንክ ቀዳሕ',
      share: 'ኣካፍል',
      recent_commissions: 'ካብ ቀረባ ዝተረኽበ ኮሚሽን',
      copied: 'ሊንክ ተቐዲሑ!',
    },
    settings: {
      title: 'ኣቀማምጣ',
      updated: 'ቋንቋ ተቐይሩ!',
      save: 'ዓቅም',
      night_mode: 'ለይቲ ሞድ',
      language: 'ቋንቋ',
      sound: 'ድምጺ',
      muted: 'ድምጺ ጠፊኡ',
      enabled: 'ነቒሉ',
      tap_to_enable: 'ንምንቃዕ ውቀዕ',
      tap_to_mute: 'ንምጥፋእ ውቀዕ',
      rules_title: '🏆 ሕግታት ጸወታ',
    },
    shamo: {
      badge_label: 'ናይ ሻሞ ህያብ',
      title: 'SHA MO',
      subtitle: 'መዓልቲ መዓልቲ ሰዓት 3:00 ምሸት',
      next_in: 'ቀጻሊ ሻሞ ዝጅምር ብ',
      hours: 'ሰዓት',
      minutes: 'ደቒቕ',
      seconds: 'ሰከንድ',
      pick_title: 'ናይ ምስጢር ሳጹን ምረጹ',
      pick_hint: 'ሻሞ ምስ ተኸፍተ ናይ ህያብ ሳጹናት ጠውቑ',
      claim_button: 'ሳጹን ክፈት',
      claimed: 'ተወሲዱ',
      prize_line: 'ብሓደ ሳጹን 50 ብር · ዝተቖለፈ ጉርሻ',
      boxes_opened: 'ሳጹናት ተኸፊቶም',
      not_active: 'ሻሞ ሕጂ ንጡፍ ኣይኮነን።',
      need_deposit: 'ኣብ ዝሓለፉ 7 መዓልትታት ውሽጢ ዝተረጋገጸ ኣታዊ የድሊ።',
      cooldown: 'ኣብ 24 ሰዓት ሓደ ግዜ ጥራይ ናይ ሻሞ ሽልማት።',
      already_claimed: 'ኣብዚ ዙር ቀዲምኩም ተቐቢልኩም።',
      button_taken: 'እዚ ሳጹን ተወሲዱ። ካልእ ምረጹ።',
      claim_failed: 'ምውሳድ ኣይተኻእለን፣ እንደገና ፈትኑ።',
      won: '🎉 50 ብር ተዓዊትኩም (ዝተቖለፈ ጉርሻ)!',
      started: 'ሻሞ ተጀሚሩ! ናይ ህያብ ሳጹናት ጠውቑ።',
      ended: 'ናይ ሻሞ ዙር ተወዲኡ። ስለ ዝተጻወትኩም ኣመስግነኩም!',
    },
    rules: {
      card_selection: 'ካርድ ምርጫ',
      card_selection_desc: 'ኣብ 30 ካልኢታት ዘለእዎ ምርጫ ዙር ሓደ ካርድ ምረጹ። ነፍሲ ወከፍ ካርድ 10 ETB የከፍል። ጸወታ ቅድሚ ምጅማሩ ካርድኩም ሸይጥኩም ገንዘብኩም ክትመልሱ ትኽእሉ።',
      gameplay: 'ጸወታ',
      gameplay_desc: 'ቁጽሪታት ካብ 1 ክሳብ 75 ብነፍሲ ወከፍ ካልኢ ይውጻእ። ኣብ ካርድኩም ዘሎ ቁጽሪ ምስ ዝወጸ ቁጽሪ ዚሰማማዕ ምልክት ግበሩ።',
      win_conditions: 'ናይ ምዕዋም ምዃን ሁኔታታት',
      win_conditions_desc: 'ምሉእ መስመር፣ ምሉእ ዓንዲ፣ ርእሰ ዲያጎን፣ ተቐራባዒ ዲያጎን ወይ ኣርባዕተ ጥግታት ኣጠናቅቁ።',
      claiming: 'ሽልማት ምርካብ',
      claiming_desc: 'ሕጹዕ ቅጥ ምስ ኣጠናቀኹም "BINGO!" ዝብል ቁልፊ ጠውቑ። ሽልማት (ካብ 10% ኮሚሽን ድሕሪ ምቕነስ) ብዅሎም ተዓዋቲ ይከፈል።',
      penalty: 'ቅጻዕቲ',
      penalty_desc: 'ሓሶት ጥያቄ ነቲ ዙር ይከልክሎም። ተደጋጋሚ ጥሓስ ብቕዓት ናይ ዘለኣለም ክልከላ የምጽእ።',
    },
    common: { close: 'ዕጾ', back: 'ተመለስ' },
  },
  om: {
    nav: {
      game: 'Tapha',
      history: 'Seenaa',
      leaderboard: 'Boorantaa',
      profile: 'Imaammata',
      settings: 'Sajoo',
      deposit: 'Kuusaa',       // <-- add
    },
    wallet: {
      title: 'Kiyyaa Ko',
      balance_etb: 'Qarshii Taphaa (ETB)',
      balance_main: 'Hamma Qarshii (ETB)',
      deposit: 'Kuusaa',
      withdraw: 'Baafadhu',
    },
    invite: {
      title: 'Hiriyoota Affeeri',
      code: 'Koodii Waamicha',
      referrals: 'Warri Waamfamne',
      earnings: 'Bu\'aa',
      copy_link: 'Liinkii Faayilii',
      share: 'Waliin Qoodadhu',
      recent_commissions: 'Kommishinii Dhiyaatee',
      copied: 'Liinkii faayilame!',
    },
    settings: {
      title: 'Sajoo',
      updated: 'Afaan jijjirame!',
      save: 'Oolchi',
      night_mode: 'Halkan Mode',
      language: 'Afaan',
      sound: 'Sagalee',
      muted: 'Sagalee dhaame',
      enabled: 'Toleeffame',
      tap_to_enable: 'Toleeffachuuf tuqi',
      tap_to_mute: 'Dhaamuu tuqi',
      rules_title: '🏆 Seera Taphaa',
    },
    shamo: {
      badge_label: 'Kennaa ሻሞ',
      title: 'SHA MO',
      subtitle: 'GUYYUU GUYYAAN SA’A 9:00 GALGALA',
      next_in: 'ሻሞ itti aanu eegala',
      hours: 'SA’AATII',
      minutes: 'DAQIIQAA',
      seconds: 'SEKONDII',
      pick_title: 'Sanduuqa Dhoksaa Filadhu',
      pick_hint: 'Yeroo ሻሞ banaa, sanduuqota kennaa tuqi',
      claim_button: 'Sanduuqa Bani',
      claimed: 'Fudhatame',
      prize_line: 'Sanduuqa tokkoof 50 ETB · buusii cufaa',
      boxes_opened: 'sanduuqota banaman',
      not_active: 'ሻሞ amma hin hojiirra jiru.',
      need_deposit: 'Guyyoota 7 darban keessatti galii mirkanaa’e barbaachisa.',
      cooldown: 'Sa’aatii 24 keessatti ሻሞ tokko qofa.',
      already_claimed: 'Wareega kana dura fudhatteetta.',
      button_taken: 'Sanduuqni sun fudhatameera. Kan biraa filadhu.',
      claim_failed: 'Fudhachuu hin dandeenye, irra deebi’i.',
      won: '🎉 50 ETB mo’atte (buusii cufaa)!',
      started: 'ሻሞ jalqabe! Sanduuqota kennaa tuqi.',
      ended: 'Wareegni ሻሞ xumurame. Tapha keetiif galatoomi!',
    },
    rules: {
      card_selection: 'Filannoo Kaardii',
      card_selection_desc: 'Filannoo 30 sec keessatti kaardii tokko filadhu. Kaardiin tokkoon 10 ETB. Taphoota dura kaardii kee gurguruun maallaqa kee deebifachuu dandeessa.',
      gameplay: 'Taphuu',
      gameplay_desc: 'Lakkoofsi 1-75 yeroo hundaa baafama. Lakkoofsa kaardii kee irratti argamu tuquun mallattoo godhi.',
      win_conditions: 'Haalota Mo\'uu',
      win_conditions_desc: 'Tartii guutuu, shifirii guutuu, diagonal guddaa, diagonal faallaa ykn rogdoma afran guutuu.',
      claiming: 'Badhaasa Argachuu',
      claiming_desc: 'Toora sirrii yeroo xumurtu "BINGO!" tuqi. Badhaasi (10% komishinii irraa hirame) mo\'attoota gidduutti qoodama.',
      penalty: 'Adabbii',
      penalty_desc: 'Sobaan BINGO! jechuun marsaa kanaaf ni dhorkama. Irra deddeebi\'uun dhorkama dhaabbataa fiduu danda\'a.',
    },
    common: { close: 'Cufi', back: 'Duuba' },
  },
  so: {
     nav: {
      game: 'Ciyaar',
      history: 'Taariikh',
      leaderboard: 'Hogaamiyayaal',
      profile: 'Xogta',
      settings: 'Dejinta',
      deposit: 'Dhig',         // <-- add
    },
    wallet: {
      title: 'Boorsadeyda',
      balance_etb: 'Qadaadka Ciyaarta (ETB)',
      balance_main: 'Isku dheel (ETB)',
      deposit: 'Dhig',
      withdraw: 'Ka bixi',
    },
    invite: {
      title: 'Kuukul Asxaabta',
      code: 'Koodhka Kuukulka',
      referrals: 'Dadka lagu soo qabtay',
      earnings: 'Dakhliga',
      copy_link: 'Linkiga nuqul ka dhigo',
      share: 'La wadaag',
      recent_commissions: 'Koomishinka ugu dambeeyay',
      copied: 'Linkiga la qaadey!',
    },
    settings: {
      title: 'Dejinta',
      updated: 'Luuqadda waa la bedelay!',
      save: 'Kaydi',
      night_mode: 'Habka Habeen',
      language: 'Luuqadda',
      sound: 'Codka',
      muted: 'Aamus',
      enabled: 'Firfircoon',
      tap_to_enable: 'Taabo si aad u dejiso',
      tap_to_mute: 'Taabo si aad u damiso',
      rules_title: '🏆 Xeerarka Ciyaarta',
    },
    shamo: {
      badge_label: 'Hadiyada ሻሞ',
      title: 'SHA MO',
      subtitle: 'MAALIN KASTA 9:00 FIIDNIMO',
      next_in: 'ሻሞ xiga wuxuu bilaabmayaa',
      hours: 'SAACADO',
      minutes: 'DAQIIQADO',
      seconds: 'ILBIRIQSIYO',
      pick_title: 'Dooro Sanduuqa Qarsoodiga',
      pick_hint: 'Markii ሻሞ furmo, taabo sanduuqyada hadiyadda',
      claim_button: 'Fur Sanduuqa',
      claimed: 'La qaatay',
      prize_line: '50 ETB sanduuq kasta · gunno xidhan',
      boxes_opened: 'sanduuqyo la furay',
      not_active: 'ሻሞ hadda ma shaqeynayo.',
      need_deposit: 'Waxaad u baahan tahay deebaaji la xaqiijiyay 7 maalmood ee u dambeeyay.',
      cooldown: 'Hal abaalmarin ሻሞ 24 saac kasta.',
      already_claimed: 'Hore ayaad u qaadatay wareegan.',
      button_taken: 'Sanduuqaas hadda la qaatay. Mid kale dooro.',
      claim_failed: 'Qaadashada wuu guuldareystay, isku day mar kale.',
      won: '🎉 Waxaad ku guuleysatay 50 ETB (gunno xidhan)!',
      started: 'ሻሞ wuu bilaabmay! Taabo sanduuqyada hadiyadda.',
      ended: 'Wareega ሻሞ wuu dhammaaday. Waad mahadsan tahay!',
    },
    rules: {
      card_selection: 'Xulashada Kaadhka',
      card_selection_desc: 'Muddo 30 sec ah hal kaadh xulo. Kaadh kasta waa 10 ETB. Ciyaarta ka hor kaadhkaaga iibin kartaa si aad lacagtaada u soo ceshato.',
      gameplay: 'Ciyaarta',
      gameplay_desc: 'Lambarro 1-75 ayaa la bixiyaa ilbiriqsi kasta. Lambar ku jira kaadhkaaga oo la bixiyay taabo si aad u calaamaddiso.',
      win_conditions: 'Xaaladaha Guulista',
      win_conditions_desc: 'Saf dhamaystiran, tiir dhamaystiran, jaantarka dhexe, jaantarka lidka ah ama afar geesood dhamaystir.',
      claiming: 'Helista Abaalmarinta',
      claiming_desc: 'Marka aad qaab sax ah dhamaystirto "BINGO!" taabo. Abaalmarinta (10% laga jaray) waxaa loo qaybiyaa dhammaan guuleystayaasha.',
      penalty: 'Ciqaab',
      penalty_desc: 'Been sheegasho ayaad ciyaarta wareegaas ka mamnuucaysaa. Ku soo noqnoqoshada waxay horseedi kartaa mamnuucid joogto ah.',
    },
    common: { close: 'Xidh', back: 'Dib u noqo' },
  },
};

function getTranslation(lang: string) {
  return translations[lang as keyof typeof translations] || translations.en;
}

type Phase = 'selection' | 'game' | 'winner';

export default function GameCanvas() {
  const [userId, setUserId] = createSignal('');
  const [username, setUsername] = createSignal('');
  const [balance, setBalance] = createSignal(0);
  const [sessionExpired, setSessionExpired] = createSignal(false);
  const [showDuplicatePopup, setShowDuplicatePopup] = createSignal(false);
  const [showNetworkPopup, setShowNetworkPopup] = createSignal(false);
  const [showSessionExpiredPopup, setShowSessionExpiredPopup] = createSignal(false);
  const [viewMode, setViewMode] = createSignal<'selection' | 'game'>('selection');
  const [winnerCardData, setWinnerCardData] = createSignal<any>(null);
  const [winnerDrawnBalls, setWinnerDrawnBalls] = createSignal<number[]>([]);
  const [hasGameState, setHasGameState] = createSignal(false);
  const [claiming, setClaiming] = createSignal(false);
  let claimTimeout: ReturnType<typeof setTimeout> | null = null;
  const AUTO_CLAIM_GRACE_MS = 1500;
  let autoClaimTimer: ReturnType<typeof setTimeout> | null = null;
  const [claimedCardIds, setClaimedCardIds] = createSignal<Set<number>>(new Set());

  const [phase, setPhase] = createSignal<Phase>('selection');
  const [roundId, setRoundId] = createSignal('');
  const [countdown, setCountdown] = createSignal(30);
  const [drawnBalls, setDrawnBalls] = createSignal<number[]>([]);
  const [prizePool, setPrizePool] = createSignal(0);
  const [winner, setWinner] = createSignal<{ userId: string; username: string; prize: number; winnerCardId?: number } | null>(null);
  const [winners, setWinners] = createSignal<Array<{ userId: string; username: string; prize: number; winnerCardId?: number }> | null>(null);
  const [onlineUsers, setOnlineUsers] = createSignal(0);
  const [activePlayers, setActivePlayers] = createSignal(0);

  const [userCards, setUserCards] = createSignal<number[]>([]);
  const [userMarks, setUserMarks] = createSignal<Map<number, Set<number>>>(new Map());
  const [activeCardTab, setActiveCardTab] = createSignal(0);

  const [availableCards, setAvailableCards] = createSignal<number[]>([]);
  const [isBannedThisRound, setIsBannedThisRound] = createSignal(false);
  const [activePopup, setActivePopup] = createSignal<'wallet' | 'invite' | 'settings' | null>(null);
  const [currentMainTab, setCurrentMainTab] = createSignal<'game' | 'history' | 'leaderboard' | 'profile' | 'settings' | 'wallet'>('game');
  const [userLanguage, setUserLanguage] = createSignal('en');
  const [socket, setSocket] = createSignal<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = createSignal<'online' | 'reconnecting' | 'offline'>('offline');
  const [soundEnabled, setSoundEnabled] = createSignal(true);
  const [muted, setMuted] = createSignal(localStorage.getItem('bingo_muted') === 'true');
  const [reconnectAttempt, setReconnectAttempt] = createSignal(0);
  const [deviceOffline, setDeviceOffline] = createSignal(!navigator.onLine);
  const [processingMarks, setProcessingMarks] = createSignal<Set<number>>(new Set());
const [markRequestInFlight, setMarkRequestInFlight] = createSignal<Set<string>>(new Set()); // new
  const [processingCard, setProcessingCard] = createSignal(false);
  const [referralData, setReferralData] = createSignal<any>(null);
  const [loadingReferral, setLoadingReferral] = createSignal(false);
  const [gamePaused, setGamePaused] = createSignal(false);
  const [phoneNumber, setPhoneNumber] = createSignal('');
  const [referralCode, setReferralCode] = createSignal('');
  const [userBalances, setUserBalances] = createSignal({ etb: 0, main: 0, locked: 0, phoneNumber: '' });
  const [autoModeEnabled, setAutoModeEnabled] = createSignal(localStorage.getItem('bingo_auto_mode') === 'true');

  const [isAgent, setIsAgent] = createSignal(false);

  // Pending transaction state
const [pendingTx, setPendingTx] = createSignal<any>(null);
const [showPendingModal, setShowPendingModal] = createSignal(false);
let pendingTxPollInterval: ReturnType<typeof setInterval> | null = null;

let pendingShamoResolve: ((r: { success: boolean; error?: string }) => void) | null = null;
let pendingShamoTimer: ReturnType<typeof setTimeout> | null = null;

// ── Shamo state ──
const [shamoState, setShamoState] = createSignal<{
  roundId: string;
  status: string;
  totalButtons: number;
  prizePerButton: number;
  claimedCount: number;
  claimedButtons: number[];
  claimedUsers: string[];
  eligibilityDepositDays: number;
  cooldownHours: number;
  startedAt?: string;
} | null>(null);

const [shamoNextStart, setShamoNextStart] = createSignal<string | null>(null);
const [showShamo, setShowShamo] = createSignal(false);
const [shamoCountdownSec, setShamoCountdownSec] = createSignal(0);



    const ballSoundCache = new Map<string, Howl>();
  const bingoWinSound = new Howl({
    src: ['/sounds/bingowin.mp3'],
    volume: 0.9,
    html5: true,
  });
  bingoWinSound.mute(muted());

  // ── Audio‑context unlock (required by all browsers) ──
  let audioUnlocked = false;
  const unlockAudio = () => {
    if (audioUnlocked) return;
    try {
      if (Howler.ctx && Howler.ctx.state !== 'running') {
        Howler.ctx.resume();
      }
      // Play a silent “unlock” sound to fully activate the context
      const silent = new Howl({
        src: ['data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA//////////////////////////////////////////////////////////////////8AAAA8TEFNRTMuOThyAc0AAAAAAAAAABSAJAJAQgAAgAAAA8AAB+0BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//uQxAAAAANIAAAAAgAAAAA'],
        volume: 0,
        html5: false,
      });
      silent.play();
      audioUnlocked = true;
    } catch (e) {
      // ignore
    }
  };

  // Trigger unlock on the first user interaction (any tap, click, key)
  const unlockHandler = () => {
    unlockAudio();
    ['click', 'touchstart', 'keydown'].forEach(e =>
      window.removeEventListener(e, unlockHandler)
    );
  };
  ['click', 'touchstart', 'keydown'].forEach(e =>
    window.addEventListener(e, unlockHandler, { once: true })
  );

  // ── Robust, non‑blocking sound queue ──
  const [soundQueue, setSoundQueue] = createSignal<number[]>([]);
  let isProcessing = false;

  const processSoundQueue = () => {
    const queue = soundQueue();
    if (queue.length === 0) {
      isProcessing = false;
      return;
    }
    const ball = queue[0];
    setSoundQueue(prev => prev.slice(1));

    const key = `${getBingoLetter(ball)}${ball}`;
    let sound = ballSoundCache.get(key);
    if (!sound) {
      sound = new Howl({
        src: [`/sounds/${key}.mp3`],
        volume: muted() ? 0 : 0.8,
        html5: true,
        preload: true,
      });
      ballSoundCache.set(key, sound);
    } else {
      sound.volume(muted() ? 0 : 0.8);
    }

    sound.once('loaderror', () => ballSoundCache.delete(key));

    try {
      sound.play();
    } catch {
      // silent fail – browser may block, queue continues
    }

    // Keep processing every 150ms until the queue is empty
    setTimeout(processSoundQueue, 150);
  };

  const playBallSound = (number: number) => {
    if (muted()) return;
    setSoundQueue(prev => [...prev, number]);
    if (!isProcessing) {
      isProcessing = true;
      processSoundQueue();
    }
  };

  // ── Preload all 75 ball sounds (same reliability as the win sound) ──
  const preloadBallSounds = () => {
    for (let i = 1; i <= 75; i++) {
      const key = `${getBingoLetter(i)}${i}`;
      if (!ballSoundCache.has(key)) {
        const sound = new Howl({
          src: [`/sounds/${key}.mp3`],
          volume: 0,
          preload: true,
        });
        ballSoundCache.set(key, sound);
      }
    }
  };

const fetchPendingTransaction = async () => {
  const token = localStorage.getItem('etm_token');
  if (!token) return;
  try {
    const apiBase = import.meta.env.VITE_API_URL || '';
    const res = await fetch(`${apiBase}/api/user/pending-transaction?token=${token}`);
    if (res.ok) {
      const data = await res.json();
      setPendingTx(data.pending || null);
    }
  } catch {}
};

const refreshShamoInfo = async () => {
  try {
    const apiBase = import.meta.env.VITE_API_URL || '';
    const r = await fetch(`${apiBase}/api/user/shamo-info`);
    if (r.ok) {
      const j = await r.json();
      setShamoState(j.active || null);
      setShamoNextStart(j.nextStartAt || null);
    }
  } catch {}
};

  const t = (key: string) => {
    const keys = key.split('.');
    let val: any = getTranslation(userLanguage());
    for (const k of keys) {
      val = val?.[k];
      if (val === undefined) break;
    }
    return val || key;
  };

  const netPrizePool = createMemo(() => prizePool() * (1 - 0.2));
  const lastBall = createMemo(() => drawnBalls()[drawnBalls().length - 1]);
  const lastThree = createMemo(() => drawnBalls().slice(-3).reverse());
  let balanceRefreshTimer: ReturnType<typeof setTimeout> | null = null;

  const refreshUserBalance = () => {
    if (balanceRefreshTimer) clearTimeout(balanceRefreshTimer);
    balanceRefreshTimer = setTimeout(() => {
      const token = localStorage.getItem('etm_token');
      if (token) fetchUserData(token);
    }, 300);
  };


  createEffect(() => {
  const target = shamoState()?.startedAt
    ? null
    : shamoNextStart()
      ? new Date(shamoNextStart()!).getTime()
      : null;

  if (!target) {
    setShamoCountdownSec(0);
    return;
  }

  const tick = () => {
    const remaining = Math.max(0, Math.floor((target - Date.now()) / 1000));
    setShamoCountdownSec(remaining);
  };
  tick();
  const iv = setInterval(tick, 1000);
  onCleanup(() => clearInterval(iv));
});

  createEffect(() => {
    const cards = userCards();
    if (activeCardTab() >= cards.length && cards.length > 0) setActiveCardTab(0);
  });


  createEffect(() => {
    localStorage.setItem('bingo_muted', muted() ? 'true' : 'false');
    bingoWinSound.mute(muted());
    ballSoundCache.forEach(sound => sound.mute(muted()));
  });

  createEffect(() => {
    localStorage.setItem('bingo_auto_mode', autoModeEnabled() ? 'true' : 'false');
  });

  createEffect(() => {
    if (!autoModeEnabled() && autoClaimTimer) {
      clearTimeout(autoClaimTimer);
      autoClaimTimer = null;
    }
  });

 const hasBingoPattern = (cardNumbers: number[][] | undefined, marks: Set<number>): boolean => {
    if (!cardNumbers) return false;

    const isMarked = (num: number) => num === 0 || marks.has(num);

    // Rows
    for (let r = 0; r < 5; r++) if (cardNumbers[r].every(isMarked)) return true;

    // Columns
    for (let c = 0; c < 5; c++) if (cardNumbers.every(row => isMarked(row[c]))) return true;

    // Main diagonal
    if (cardNumbers.every((row, i) => isMarked(row[i]))) return true;

    // Anti diagonal
    if (cardNumbers.every((row, i) => isMarked(row[4 - i]))) return true;

    // Four corners
    const corners = [cardNumbers[0][0], cardNumbers[0][4], cardNumbers[4][0], cardNumbers[4][4]];
    if (corners.every(isMarked)) return true;

    // Four-number middle column (center is free space, excluded)
    const middleColumn = [cardNumbers[0][2], cardNumbers[1][2], cardNumbers[3][2], cardNumbers[4][2]];
    if (middleColumn.every(isMarked)) return true;

    return false;
};

  const checkAndAutoClaim = () => {
    if (!autoModeEnabled()) return;
    if (isBannedThisRound() || phase() !== 'game') return;

    const anyBingo = userCards().some(cid => {
      if (claimedCardIds().has(cid)) return false;
      const cardData = getCachedCard(cid);
      return cardData && hasBingoPattern(cardData.numbers, userMarks().get(cid) || new Set());
    });
    if (!anyBingo) return;

    if (autoClaimTimer) clearTimeout(autoClaimTimer);
    autoClaimTimer = setTimeout(() => {
      autoClaimTimer = null;
      for (const cid of userCards()) {
        if (claimedCardIds().has(cid)) continue;
        const cardData = getCachedCard(cid);
        if (cardData && hasBingoPattern(cardData.numbers, userMarks().get(cid) || new Set())) {
          doClaim(cid);
        }
      }
    }, AUTO_CLAIM_GRACE_MS);
  };

  onMount(() => {
    const handleOnline = () => {
      setDeviceOffline(false);
      showToast('Device back online', 'success', 2000);
      if (connectionStatus() !== 'online') connect();
    };
    const handleOffline = () => {
      setDeviceOffline(true);
      showToast('Device offline. Check your internet.', 'error', 5000);
      if (socket()) socket()?.close();
      setConnectionStatus('offline');
      setTimeout(() => {
        if (connectionStatus() === 'offline') setShowNetworkPopup(true);
      }, 2000);
    };
        // Fetch Shamo state once (badge + popup need it)
    refreshShamoInfo();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    onCleanup(() => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    });
  });

  const validateSession = () => {
    const token = localStorage.getItem('etm_token');
    if (!token) {
      setSessionExpired(true);
      setShowSessionExpiredPopup(true);
      return false;
    }
    try {
      const decoded: any = jwtDecode(token);
      if (decoded.exp * 1000 < Date.now()) {
        localStorage.removeItem('etm_token');
        setSessionExpired(true);
        setShowSessionExpiredPopup(true);
        return false;
      }
      setSessionExpired(false);
      setShowSessionExpiredPopup(false);
      setUserId(decoded.uid);
      fetchUserData(token);
      return true;
    } catch {
      localStorage.removeItem('etm_token');
      setSessionExpired(true);
      setShowSessionExpiredPopup(true);
      return false;
    }
  };

  const fetchUserData = async (token: string) => {
    const apiBase = import.meta.env.VITE_API_URL || '';
    try {
      const res = await fetch(`${apiBase}/api/user/me?token=${token}`);
      if (res.ok) {
        const data = await res.json();
        setBalance(data.ETBCoins || 0);
        setUsername(data.username || data.firstName || 'Player');
        setUserBalances({
          etb: data.ETBCoins || 0,
          main: data.balanceMain || 0,
          locked: data.lockedBalance || 0,
          phoneNumber: data.phoneNumber || ''
        });
        setIsAgent(data.isAgent === true);
        setUserLanguage(data.language || 'en');
        setPhoneNumber(data.phoneNumber || '');
        setReferralCode(data.referralCode || '');
        setSessionExpired(false);
        setShowSessionExpiredPopup(false);
      } else if (res.status === 401) {
        localStorage.removeItem('etm_token');
        setSessionExpired(true);
        setShowSessionExpiredPopup(true);
      }
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    }
  };

  const loadReferralData = async () => {
    if (referralData() || loadingReferral()) return;
    setLoadingReferral(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      const token = localStorage.getItem('etm_token') || '';
      const res = await fetch(`${apiBase}/api/user/referral?token=${token}`);
      if (res.ok) {
        const data = await res.json();
        setReferralData(data);
      }
    } catch (err) {
      console.error('Failed to load referral data:', err);
    } finally {
      setLoadingReferral(false);
    }
  };

  createEffect(() => {
    if (currentMainTab() === 'profile') {
      loadReferralData();
    }
  });

  const handleCardSelect = (cardId: number) => {
    if (processingCard()) return;
    if (phase() !== 'selection') { showToast('Card selection only allowed during selection phase', 'info'); return; }

    const current = userCards();
    const alreadyOwned = current.includes(cardId);

    if (alreadyOwned) {
      setProcessingCard(true);
      socket()?.send(JSON.stringify({ type: 'sell_card', cardId }));
      setUserCards(prev => prev.filter(c => c !== cardId));
      setUserMarks(prev => {
        const newMap = new Map(prev);
        newMap.delete(cardId);
        return newMap;
      });
      setTimeout(() => { if (processingCard()) setProcessingCard(false); }, 1000);
      return;
    }

    if (!availableCards().includes(cardId)) { showToast('Card not available', 'error'); return; }

    if (current.length >= 2) { showToast('You already have 2 cards', 'error'); return; }

    setProcessingCard(true);
    setUserCards(prev => [...prev, cardId]);

    socket()?.send(JSON.stringify({ type: 'select_card', cardId }));
    setTimeout(() => {
      if (processingCard()) {
        setProcessingCard(false);
        setUserCards(prev => prev.filter(c => c !== cardId));
      }
    }, 1000);
  };

 const handleMarkNumber = (number: number, cardId: number) => {
  if (!Number.isInteger(number) || number < 1 || number > 75) return;  // ← absolute safety
  if (phase() !== 'game') return;
  if (!drawnBalls().includes(number)) return;
  if (claiming()) return;
  const cardMarks = userMarks().get(cardId);
  if (cardMarks?.has(number)) return;

  const dedupKey = `${cardId}:${number}`;
  if (markRequestInFlight().has(dedupKey)) return;

  batch(() => {
    setMarkRequestInFlight(prev => new Set(prev).add(dedupKey));
    setProcessingMarks(prev => new Set(prev).add(number));  // number, not key
    setUserMarks(prev => {
      const newMap = new Map(prev);
      const marks = newMap.get(cardId) || new Set<number>();
      const newSet = new Set(marks);
      newSet.add(number);
      newMap.set(cardId, newSet);
      return newMap;
    });
  });

  socket()?.send(JSON.stringify({ type: 'mark_number', number, cardId }));
};

  const handleClaimBingo = (cardId: number) => {
    if (claiming() || isBannedThisRound()) return;
    setClaiming(true);
    claimTimeout = setTimeout(() => {
      if (claiming()) {
        setClaiming(false);
        showToast('Server is busy, try again.', 'info');
      }
    }, 6000);
    socket()?.send(JSON.stringify({ type: 'claim_bingo', cardId }));
  };

  const connect = () => {
    if (deviceOffline()) {
      setConnectionStatus('offline');
      return;
    }
    if (!validateSession()) {
      setConnectionStatus('offline');
      return;
    }

    if (socket()?.readyState === WebSocket.OPEN) return;
    setConnectionStatus('reconnecting');
    setReconnectAttempt(prev => prev + 1);

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:4000';
    const ws = new WebSocket(`${wsUrl}/ws?token=${localStorage.getItem('etm_token')}`);

    ws.onopen = () => {
      setConnectionStatus('online');
      setReconnectAttempt(0);
      setShowNetworkPopup(false);
      showToast('Connected to game server', 'success', 2000);
    };

    ws.onmessage = async (e) => {
      try {
        const msg = JSON.parse(e.data);
        switch (msg.type) {
          case 'game_state': {
            batch(() => {
              setPhase(msg.data.phase);
              setRoundId(msg.data.roundId);
              setCountdown(msg.data.countdown);
              setDrawnBalls(msg.data.drawnBalls);
              setPrizePool(msg.data.prizePool);
              setOnlineUsers(msg.data.onlineUsers);
              setActivePlayers(msg.data.activePlayers);
              setUserCards(msg.data.userCards || []);
              const marksMap = new Map<number, Set<number>>();
              if (msg.data.userMarks && typeof msg.data.userMarks === 'object') {
                for (const [cardId, marksArr] of Object.entries(msg.data.userMarks)) {
                  marksMap.set(Number(cardId), new Set<number>(marksArr as number[]));
                }
              }
              setUserMarks(marksMap);
              setAvailableCards(msg.data.availableCards || []);
              setIsBannedThisRound(msg.data.banned || false);
            });
            if (msg.data.phase === 'selection') setViewMode('selection');
            else if (msg.data.phase === 'game') setViewMode('game');
            setHasGameState(true);
            break;
          }
          case 'available_cards_update':
            setAvailableCards(msg.data.available);
            break;
          case 'ball':
            playBallSound(msg.data.ball);            // ← moved up
            const ballNumber = msg.data.ball;
            if (ballNumber < 1 || ballNumber > 75) break;  // ← ignore phantom/invalid balls
            if (autoClaimTimer) {
              clearTimeout(autoClaimTimer);
              autoClaimTimer = null;
            }
            if (drawnBalls().length >= 75) break;
            setDrawnBalls(prev => [...prev, msg.data.ball]);
            if (autoModeEnabled() && !isBannedThisRound() && phase() === 'game' && !claiming()) {
              const ballNumber = msg.data.ball;
              for (const cid of userCards()) {
                const cardData = getCachedCard(cid);
                if (cardData) {
                  const flatNumbers = cardData.numbers.flat();
                  const cardMarks = userMarks().get(cid);
                  if (flatNumbers.includes(ballNumber) && !cardMarks?.has(ballNumber)) {
                    handleMarkNumber(ballNumber, cid);
                  }
                }
              }
            }
            break;
          case 'countdown':
            setCountdown(msg.data.countdown);
            break;
          case 'stats_update':
            batch(() => {
              setOnlineUsers(msg.data.onlineUsers);
              setActivePlayers(msg.data.activePlayers);
            });
            break;
          case 'phase_change': {
            const { phase: newPhase, countdown: newCountdown, winners: newWinners } = msg.data;
            if (newPhase === 'winner') {
              batch(() => {
                setPhase(newPhase);
                setWinners(newWinners);
              });
              setClaiming(false);
              if (claimTimeout) clearTimeout(claimTimeout);
              showToast('BINGO!', 'success', 5000);
            } else if (newPhase === 'selection') {
              if (autoClaimTimer) {
                clearTimeout(autoClaimTimer);
                autoClaimTimer = null;
              }
              batch(() => {
                setPhase(newPhase);
                setClaiming(false);
                setClaimedCardIds(new Set<number>());
                setCountdown(newCountdown);
                setDrawnBalls([]);
                setPrizePool(0);
                setWinner(null);
                setWinners(null);
                setUserCards([]);
                setUserMarks(new Map<number, Set<number>>());
                setActiveCardTab(0);
                setProcessingMarks(new Set<number>());
                setMarkRequestInFlight(new Set<string>()); // add this line
                setIsBannedThisRound(false);
              });
              setViewMode('selection');
              setProcessingCard(false);
              showToast('Select your cards!', 'info', 3000);
            } else if (newPhase === 'game') {
              batch(() => {
                setPhase(newPhase);
                setCountdown(newCountdown);
              });
              setViewMode('game');
              showToast('Game phase started! Good luck!', 'success', 3000);
            }
            break;
          }
          case 'round_ended': {
            if (autoClaimTimer) {
              clearTimeout(autoClaimTimer);
              autoClaimTimer = null;
            }
            const { winnerIds, winnerNames, winAmount, winnerCardIds, winnerId, winnerName, winnerCardId } = msg.data;
            let winnersArray: Array<{ userId: string; username: string; prize: number; winnerCardId?: number }> = [];
            if (phase() === 'winner') return;

            if (winnerIds && winnerNames && winAmount) {
              winnersArray = winnerIds.map((id: string, idx: number) => ({
                userId: id,
                username: winnerNames[idx],
                prize: winAmount,
                winnerCardId: winnerCardIds?.[idx],
              }));
            } else if (winnerId && winnerName && winAmount) {
              winnersArray = [{ userId: winnerId, username: winnerName, prize: winAmount, winnerCardId }];
            }

            batch(() => {
              setPhase('winner');
              setWinners(winnersArray);
            });

            if (soundEnabled() && winnersArray.length > 0) {
              bingoWinSound.play();
            }

            if (winnersArray.length > 0 && winnersArray[0].userId === userId()) {
              showToast(`YOU WON! +${winAmount.toFixed(2)} ETB!`, 'success', 6000);
            } else if (winnersArray.length > 0) {
              const names = winnersArray.map(w => w.username).join(', ');
              showToast(`BINGO! ${names} won ${winAmount.toFixed(2)} ETB!`, 'info', 5000);
            } else {
              showToast('No winner this round.', 'info', 4000);
            }

            if (winnersArray.some(w => w.userId === userId())) {
              fetchUserData(localStorage.getItem('etm_token') || '');
            }

            if (winnersArray.length > 0 && winnersArray[0].winnerCardId) {
              const engineBase = import.meta.env.VITE_ENGINE_URL || 'http://localhost:4000';
              fetch(`${engineBase}/card/${winnersArray[0].winnerCardId}`, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
              })
                .then(res => res.json())
                .then(data => setWinnerCardData(data))
                .catch(err => console.error('Failed to fetch winner card', err));
            }

            setWinnerDrawnBalls([...drawnBalls()]);
            setClaiming(false);
            if (claimTimeout) clearTimeout(claimTimeout);
            break;
          }
          case 'claim_result':
            batch(() => {
              setProcessingMarks(prev => {
                const next = new Set(prev);
                next.delete(msg.number);
                return next;
              });
            });
            if (msg.success) {
              setTimeout(() => checkAndAutoClaim(), 50);
              refreshUserBalance();
            } else {
              batch(() => {
                setUserMarks(prev => {
                  const newMap = new Map(prev);
                  for (const [cid, marks] of newMap.entries()) {
                    if (marks.has(msg.number)) {
                      const newSet = new Set(marks);
                      newSet.delete(msg.number);
                      newMap.set(cid, newSet);
                    }
                  }
                  return newMap;
                });
              });
              showToast(msg.error, 'error');
            }
            break;
          case 'duplicate_session':
            showToast(msg.message, 'error', 5000);
            setConnectionStatus('offline');
            socket()?.close();
            setShowDuplicatePopup(true);
            break;
          case 'balance_updated':
            setBalance(msg.data.balance);
            setUserBalances(prev => ({ ...prev, etb: msg.data.balance }));
            refreshUserBalance();
            break;
          case 'game_paused':
            setGamePaused(msg.data.paused);
            if (msg.data.paused) {
              showToast('Game is under maintenance. Please wait.', 'info');
            }
            break;
          case 'shamo_state': {
            const s = msg.data || null;
            setShamoState(s);
            if (!s) {
              // No active round — refresh next-start info so the badge
              // stays visible with a countdown to the next round.
              refreshShamoInfo();
            }
            break;
          }
          case 'shamo_button_claimed': {
            setShamoState(prev => {
              if (!prev || prev.roundId !== msg.data.roundId) return prev;
              if (prev.claimedButtons.includes(msg.data.buttonIndex)) return prev;
              return {
                ...prev,
                claimedButtons: [...prev.claimedButtons, msg.data.buttonIndex],
                claimedCount: msg.data.claimedCount,
              };
            });
            break;
          }
          case 'shamo_started': {
            setShamoState(msg.data);
            setShamoNextStart(null);
            showToast(t('shamo.started'), 'success', 5000);   // was: 'ሻሞ started! Tap the gift boxes.'
            break;
          }
          case 'shamo_ended': {
            showToast(t('shamo.ended'), 'info', 4000);
            setTimeout(() => {
              setShamoState(null);
              setShowShamo(false);
              refreshShamoInfo();   // ← fetch next start so badge shows countdown
            }, 2500);
            break;
          }
          case 'shamo_claim_result': {
            // 1. Resolve the pending promise (was previously only timing out)
            if (pendingShamoResolve) {
              if (pendingShamoTimer) clearTimeout(pendingShamoTimer);
              const r = pendingShamoResolve;
              pendingShamoResolve = null;
              pendingShamoTimer = null;
              r({ success: !!msg.success, error: msg.error });
            }

            // 2. Toast + balance refresh
            if (msg.success) {
              showToast(
                t('shamo.won').replace('50', String(msg.prize ?? 50)),
                'success',
                5000
              );
              fetchUserData(localStorage.getItem('etm_token') || '');
            } else {
              const map: Record<string, string> = {
                NOT_ELIGIBLE:     t('shamo.need_deposit'),
                COOLDOWN_ACTIVE:  t('shamo.cooldown'),
                ALREADY_CLAIMED:  t('shamo.already_claimed'),
                BUTTON_TAKEN:     t('shamo.button_taken'),
                ROUND_NOT_ACTIVE: t('shamo.not_active'),
              };
              showToast(msg.error || map[msg.code] || t('shamo.claim_failed'), 'error', 5000);
            }
            break;
          }
          case 'user_card_update':
            setUserCards(prev => {
              if (!prev.includes(msg.data.cardId)) return [...prev, msg.data.cardId];
              return prev;
            });
            await ensureCardsLoaded([msg.data.cardId]);
            showToast(`Card #${msg.data.cardId} selected`, 'success');
            setProcessingCard(false);
            refreshUserBalance();
            break;

          case 'user_cards_update': {
            const cards: number[] = msg.data.cards;
            if (!cards || cards.length === 0) {
              setUserCards([]);
              setUserMarks(new Map());
              showToast('Cards sold', 'info');
              refreshUserBalance();
            } else {
              await ensureCardsLoaded(cards);
              setUserCards(cards);
              setUserMarks(prev => {
                const newMap = new Map<number, Set<number>>();
                for (const cid of cards) {
                  newMap.set(cid, prev.get(cid) || new Set());
                }
                return newMap;
              });
            }
            setProcessingCard(false);
            break;
          }

          case 'round_state_updated': {
            const { prizePool, availableCards } = msg.data;
            if (prizePool !== undefined) {
              setPrizePool(prizePool);
            }
            if (availableCards) {
              setAvailableCards(availableCards);
            }
            break;
          }
          case 'mark_result':
            setMarkRequestInFlight(prev => {
              const next = new Set(prev);
              next.delete(`${msg.cardId}:${msg.number}`);
              return next;
            });
            setProcessingMarks(prev => {
              const next = new Set(prev);
              next.delete(msg.number);
              return next;
            });

            if (msg.success) {
              checkAndAutoClaim();
            } else {
              const errorCode = msg.code || msg.error;
              if (
                errorCode === 'STALE_ROUND' ||
                errorCode === 'NUMBER_NOT_DRAWN' ||
                errorCode === 'Already marked'
              ) {
                // do nothing – silent suppression
              } else {
                showToast(msg.error || 'Unable to mark number', 'error');
              }
            }
            break;
          case 'prize_pool_updated':
            setPrizePool(msg.data.prizePool);
            break;
          case 'error':
            setClaiming(false);
            if (claimTimeout) clearTimeout(claimTimeout);
            if (msg.message && msg.message.toLowerCase().includes('banned')) {
              setIsBannedThisRound(true);
            }
            showToast(msg.message || "Action failed", "error");
            break;
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    ws.onclose = () => {
      setConnectionStatus('offline');
      setTimeout(() => {
        if (connectionStatus() === 'offline') setShowNetworkPopup(true);
      }, 3000);
      const delay = Math.min(3000 * Math.pow(2, reconnectAttempt()), 30000);
      setTimeout(() => {
        if (window.location.pathname === '/') connect();
      }, delay);
    };

    setSocket(ws);
  };

  onMount(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    if (tokenFromUrl) {
      try {
        const decoded: any = jwtDecode(tokenFromUrl);
        if (decoded.exp * 1000 > Date.now()) {
          localStorage.setItem('etm_token', tokenFromUrl);
        } else {
          showToast('Link expired. Request a new one.', 'error');
        }
      } catch {
        showToast('Invalid token.', 'error');
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    preloadAllCards().catch(console.error);
    preloadBallSounds(); 
    setTimeout(() => connect(), 100);

    // Start polling for pending transactions
  fetchPendingTransaction();
  pendingTxPollInterval = setInterval(fetchPendingTransaction, 10000);
    onCleanup(() => {
      socket()?.close();
      if (autoClaimTimer) clearTimeout(autoClaimTimer);
      if (pendingTxPollInterval) clearInterval(pendingTxPollInterval);
      if (pendingShamoTimer) clearTimeout(pendingShamoTimer);
      if (pendingShamoResolve) {
        pendingShamoResolve({ success: false, error: 'Unmounted' });
        pendingShamoResolve = null;
      }
      pendingShamoTimer = null;
    });
  });

  const card0Marks = createMemo(() => userMarks().get(userCards()[0]) || new Set<number>());
  const card1Marks = createMemo(() => userMarks().get(userCards()[1]) || new Set<number>());
  const doClaim = (cardId: number) => {
    if (claimedCardIds().has(cardId)) return;
    setClaimedCardIds(prev => new Set(prev).add(cardId));
    socket()?.send(JSON.stringify({ type: 'claim_bingo', cardId }));
  };

  const handleShamoClaim = (buttonIndex: number) => {
  return new Promise<{ success: boolean; error?: string }>((resolve) => {
    // Single-flight — reject if another claim is already pending
    if (pendingShamoResolve) {
      return resolve({ success: false, error: 'A claim is already in progress' });
    }

    const ws = socket();
    if (!ws || ws.readyState !== WebSocket.OPEN || !shamoState()) {
      return resolve({ success: false, error: 'Not connected' });
    }

    pendingShamoResolve = resolve;
    pendingShamoTimer = setTimeout(() => {
      pendingShamoResolve = null;
      pendingShamoTimer = null;
      resolve({ success: false, error: 'No response' });
    }, 8000);

    ws.send(JSON.stringify({
      type: 'shamo_claim',
      roundId: shamoState()!.roundId,
      buttonIndex,
    }));
  });
};

  // Open wallet popup when bottom‑nav Deposit is tapped
createEffect(() => {
  if (currentMainTab() === 'wallet') {
    setActivePopup('wallet');
    // Switch back to game tab so the popup appears on top of the game view
    setCurrentMainTab('game');
  }
});


  return (
    <div class="h-screen flex flex-col bg-tina-dark text-gray-900 font-inter relative overflow-hidden dark:bg-black dark:text-white">
      <SessionExpiredBanner
        show={sessionExpired() && !showSessionExpiredPopup()}
        onDismiss={() => setSessionExpired(false)}
      />

      {/* ── offline / reconnecting bar ── */}
      <Show when={connectionStatus() !== 'online'}>
        <div class="fixed top-0 left-0 w-full h-0.5 z-[10000]"
          style={{ background: 'linear-gradient(90deg, #0EA5E9, #22D3EE, #0EA5E9)', 'background-size': '200% 100%', animation: 'tinaBarSlide 1.2s linear infinite' }}>
        </div>
        <div class="fixed top-0.5 left-1/2 -translate-x-1/2 z-[10000] bg-black/90 border border-indigo-500/30 text-indigo-300 text-[8px] font-black uppercase tracking-wider px-3 py-1 rounded-b-lg">
          {connectionStatus() === 'reconnecting' ? '● Reconnecting' : '○ Offline'}
        </div>
      </Show>

      {/* ── maintenance overlay ── */}
      <Show when={gamePaused()}>
        <div class="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-md">
          <div class="bg-[#241541] rounded-2xl p-8 max-w-xs w-full mx-4 text-center border border-indigo-500/20">
            <div class="w-14 h-14 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto mb-5">
              <svg class="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 class="text-base font-black text-white uppercase tracking-wider mb-2">Under Maintenance</h2>
            <p class="text-gray-500 text-xs leading-relaxed">The game is temporarily paused. We'll be back shortly.</p>
          </div>
        </div>
      </Show>

      <div class="flex-1 overflow-hidden relative">
        <Show when={currentMainTab() === 'game' && hasGameState()}>
          <div class="h-full overflow-hidden">

            {/* ══════════════════ SELECTION VIEW ══════════════════ */}
            <Show when={viewMode() === 'selection'}>
              <div class="h-full overflow-y-auto custom-scrollbar p-3 pb-20">
                <SelectionView
                  availableCards={availableCards()}
                  userCards={userCards()}
                  onCardSelect={handleCardSelect}
                  countdown={countdown()}
                  balance={balance()}
                  amount={10}
                  processingCard={processingCard()}
                />
              </div>
            </Show>

            {/* ══════════════════ GAME VIEW ══════════════════ */}
            <Show when={viewMode() === 'game'}>
              <div class="h-full flex flex-col overflow-hidden">

                {/* ── Stats strip ──────────────────────────────── */}
                <div class="flex-shrink-0 flex items-stretch px-2 pt-2 pb-1 gap-0"
                  style={{ 'border-bottom': '1px solid rgba(34,211,238,0.08)' }}>
                  {[
                    { label: 'Derash', value: `${netPrizePool().toFixed(0)} ETB` },
                    { label: 'Players', value: `${activePlayers()}` },
                    { label: 'Stake', value: '10 ETB' },
                    { label: 'Called', value: `${drawnBalls().length}/75` },
                    { label: 'Round', value: roundId().slice(-5).toUpperCase() },
                  ].map((stat, i) => (
                    <div class={twMerge(
                      "flex-1 flex flex-col items-center justify-center py-1.5",
                      i < 4 ? "border-r border-white/[0.06]" : ""
                    )}>
                      <div class="text-[7px] font-bold uppercase tracking-widest text-gray-600 dark:text-gray-500 mb-0.5">{stat.label}</div>
                      <div class="text-[11px] font-black text-white tabular-nums">{stat.value}</div>
                    </div>
                  ))}
                </div>

                {/* ── Main layout: Ball board | Right column ─── */}
                <div class="flex flex-1 gap-2 min-h-0 px-2 pt-1.5 pb-14 overflow-hidden">

                  {/* LEFT — BallBoard */}
                  <div class="w-[42%] min-h-0 flex flex-col overflow-hidden">
                    <BallBoard drawnBalls={drawnBalls()} compact={true} />
                  </div>

                  {/* RIGHT — controls */}
                  <div class="w-[58%] flex flex-col gap-1.5 min-h-0 overflow-hidden">

                    {/* ── Live / Auto row ── */}
                    <div class="flex items-center justify-between flex-shrink-0">
                      {/* Live badge */}
                      <div class="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                        <div class="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ animation: 'tinaPulse 1.8s ease-in-out infinite' }} />
                        <span class="text-[8px] font-black uppercase tracking-widest text-emerald-400">Live</span>
                      </div>

                      {/* Auto toggle – modern switch */}
                        <button
                          onClick={() => setAutoModeEnabled(!autoModeEnabled())}
                          disabled={userCards().length === 0 || phase() !== 'game' || isBannedThisRound()}
                          class={`flex items-center gap-2 transition-opacity ${
                            (userCards().length === 0 || phase() !== 'game' || isBannedThisRound())
                              ? 'opacity-40 cursor-not-allowed'
                              : ''
                          }`}
                        >
                          <div
                            class={`relative h-5 w-10 rounded-full transition-colors duration-300 ${
                              autoModeEnabled() && !isBannedThisRound() && phase() === 'game' && userCards().length > 0
                                ? 'bg-indigo-500 shadow-[0_0_8px_rgba(34,211,238,0.3)]'
                                : 'bg-gray-700'
                            }`}
                          >
                            <span
                              class={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-300 ${
                                autoModeEnabled() && !isBannedThisRound() && phase() === 'game' && userCards().length > 0
                                  ? 'translate-x-5'
                                  : 'translate-x-0'
                              }`}
                            />
                          </div>
                          <span
                            class={`text-[9px] font-bold uppercase tracking-wider ${
                              autoModeEnabled() && !isBannedThisRound() && phase() === 'game' && userCards().length > 0
                                ? 'text-indigo-300'
                                : 'text-gray-500'
                            }`}
                          >
                            Auto
                          </span>
                        </button>
                    </div>

                    {/* ── Current ball display ── */}
                    <Show when={lastBall() !== undefined}>
                      <div class="flex-shrink-0 flex items-center gap-2 rounded-xl px-2.5 py-1.5"
                        style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        {/* Current ball */}
                        <div class="flex items-center gap-1.5">
                          <div class="flex flex-col items-center w-5">
                            <span class="text-[8px] font-black text-gray-500 uppercase leading-none">{getBingoLetter(lastBall()!)}</span>
                          </div>
                          <div class={twMerge(
                            "w-10 h-10 rounded-full flex items-center justify-center font-black text-white text-lg bingo-ball-3d animate-ball-glow flex-shrink-0",
                            getBallColorClass(lastBall()!)
                          )}>
                            {lastBall()}
                          </div>
                        </div>

                        {/* Divider */}
                        <div class="w-px self-stretch bg-white/8 mx-0.5" />

                        {/* Last 3 */}
                        <div class="flex gap-1.5 flex-1 justify-end">
                          <For each={lastThree()}>
                            {(ball) => (
                              <div class="flex flex-col items-center gap-0.5">
                                <span class="text-[6px] text-gray-600 uppercase font-bold leading-none">{getBingoLetter(ball)}</span>
                                <div class={twMerge(
                                  "w-6 h-6 rounded-full flex items-center justify-center font-black text-white text-[9px] bingo-ball-3d opacity-60",
                                  getBallColorClass(ball)
                                )}>
                                  {ball}
                                </div>
                              </div>
                            )}
                          </For>
                        </div>
                      </div>
                    </Show>

                    {/* ── Card(s) area ── */}
                    <div class="flex-1 min-h-0 overflow-hidden flex flex-col">
                      <Show when={userCards().length > 0} fallback={
                        <div class="h-full flex items-center justify-center">
                          <div class="relative w-full rounded-2xl p-5 text-center overflow-hidden bg-gradient-to-br from-indigo-500/10 via-transparent to-cyan-500/10 border border-indigo-500/20 shadow-[0_0_30px_rgba(34,211,238,0.1)]">
                            {/* Animated corner glow */}
                            <div class="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-indigo-400/20 blur-2xl" />
                            <div class="absolute -bottom-10 -left-10 w-24 h-24 rounded-full bg-cyan-400/20 blur-2xl" />

                            {/* Rotating loading ring */}
                            <div class="relative w-16 h-16 mx-auto mb-4">
                              <div class="absolute inset-0 rounded-full border-2 border-indigo-500/20" />
                              <div class="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-400 animate-spin" style="animation-duration: 1.6s" />
                              <div class="absolute inset-3 rounded-full border border-dashed border-indigo-400/40 animate-pulse" />
                              <div class="absolute inset-0 flex items-center justify-center">
                                <svg class="w-8 h-8 text-indigo-300/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <rect x="3" y="5" width="18" height="14" rx="2" stroke-dasharray="3 2" />
                                  <line x1="3" y1="10" x2="21" y2="10" stroke-dasharray="2 2" />
                                  <line x1="8" y1="15" x2="16" y2="15" stroke-dasharray="2 2" />
                                </svg>
                              </div>
                            </div>

                            {/* Text */}
                            <p class="text-base font-black uppercase tracking-widest text-white mb-1">
                              ካርድ የለም
                            </p>
                            <p class="text-xs text-gray-500 leading-relaxed mb-1">
                              ይህን ዙር ማለፍ ይችላሉ፣ ቀጣዩ ዙር ላይ ይሳተፉ
                            </p>
                            <p class="text-xs text-indigo-300/60 leading-relaxed">
                              ጨዋታው እየተካሄደ ነው፣ ወዲያውኑ ይጀምራል
                            </p>

                            {/* Waiting dots with shimmer */}
                            <div class="flex justify-center gap-1.5 mt-4">
                              {[0, 0.2, 0.4].map((d) => (
                                <div class="w-1.5 h-1.5 rounded-full bg-indigo-400/60"
                                  style={{ animation: `tinaDot 1.2s ease-in-out ${d}s infinite` }} />
                              ))}
                            </div>
                          </div>
                        </div>
                      }>
                        <For each={userCards()}>
                          {(cid, idx) => (
                            <div class={twMerge(
                              "min-h-0 overflow-hidden",
                              userCards().length > 1 ? "flex-1" : "h-full max-h-[280px] mx-auto w-full"
                            )}>
                              <UserCard
                                cardId={cid}
                                marks={idx() === 0 ? card0Marks() : card1Marks()}
                                processingMarks={processingMarks()}
                                drawnBalls={drawnBalls()}
                                phase={phase()}
                                onMarkNumber={(num) => handleMarkNumber(num, cid)}
                                isBanned={isBannedThisRound()}
                                compact={userCards().length > 1}
                              />
                            </div>
                          )}
                        </For>
                      </Show>
                    </div>

                    {/* ── BINGO button ── */}
                    <button
                      onClick={() => {
                        setClaiming(true);
                        const cards = userCards();
                        let claimed = false;
                        cards.forEach(cid => {
                          const cardData = getCachedCard(cid);
                          if (cardData && hasBingoPattern(cardData.numbers, userMarks().get(cid) || new Set())) {
                            doClaim(cid);
                            claimed = true;
                          }
                        });
                        if (!claimed && cards.length > 0) doClaim(cards[0]);
                        setTimeout(() => setClaiming(false), 3000);
                      }}
                      disabled={claiming() || isBannedThisRound() || userCards().length === 0 || autoModeEnabled()}
                      class={twMerge(
                        "relative w-full rounded-xl font-black uppercase tracking-[0.15em] text-sm transition-all flex-shrink-0 overflow-hidden",
                        "py-2.5",
                        (isBannedThisRound() || userCards().length === 0 || autoModeEnabled())
                          ? "bg-white/4 text-gray-600 cursor-not-allowed border border-white/5"
                          : !claiming()
                            ? "bg-indigo-600 text-white border border-indigo-400/30 hover:bg-indigo-500 active:scale-[0.98] shadow-[0_0_20px_rgba(14,165,233,0.3)]"
                            : "bg-indigo-800/60 text-indigo-400 cursor-not-allowed border border-indigo-500/20"
                      )}
                    >
                      {/* Shimmer overlay on active state */}
                      {!claiming() && !isBannedThisRound() && userCards().length > 0 && !autoModeEnabled() && (
                        <span class="absolute inset-0 pointer-events-none"
                          style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.12) 50%, transparent 60%)', animation: 'tinaBtnShimmer 2.5s ease-in-out infinite' }} />
                      )}
                      <span class="relative">
                        {claiming() ? '● Checking…' : isBannedThisRound() ? '🚫 Banned' : userCards().length === 0 ? 'No Card' : autoModeEnabled() ? 'Auto Mode' : '🎉 BINGO!'}
                      </span>
                    </button>

                  </div>{/* end right column */}
                </div>{/* end main layout */}

                {/* ── inline keyframes ── */}
                <style>{`
                  @keyframes tinaBarSlide {
                    0%   { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                  }
                  @keyframes tinaPulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50%       { opacity: 0.4; transform: scale(0.85); }
                  }
                  @keyframes tinaSweep {
                    0%   { transform: translateX(-100%); }
                    50%  { transform: translateX(100%); }
                    100% { transform: translateX(-100%); }
                  }
                  @keyframes tinaDot {
                    0%, 100% { opacity: 0.2; transform: translateY(0); }
                    50%       { opacity: 0.8; transform: translateY(-3px); }
                  }
                  @keyframes tinaBtnShimmer {
                    0%   { transform: translateX(-100%); }
                    50%  { transform: translateX(100%); }
                    100% { transform: translateX(200%); }
                  }
                `}</style>

              </div>{/* end game view flex-col */}
            </Show>

          </div>
        </Show>

        <Show when={currentMainTab() === 'history' && hasGameState()}>
          <HistoryView token={localStorage.getItem('etm_token') || ''} t={t} />
        </Show>

        <Show when={currentMainTab() === 'leaderboard' && hasGameState()}>
          <LeaderboardView token={localStorage.getItem('etm_token') || ''} t={t} />
        </Show>

        <Show when={currentMainTab() === 'profile' && hasGameState()}>
          <ProfileView
            userData={{
              _id: userId(),
              firstName: username(),
              username: username(),
              phoneNumber: userBalances().phoneNumber,
              referralCode: referralData()?.referralCode || '',
              ETBCoins: balance(),
              balanceMain: userBalances().main,
              lockedBalance: userBalances().locked,   // ← NEW
              isAgent: isAgent(),
            }}
            token={localStorage.getItem('etm_token') || ''}
            t={t}
          />
        </Show>

        <Show when={currentMainTab() === 'settings'}>
          <SettingsView
            currentLang={userLanguage()}
            token={localStorage.getItem('etm_token') || ''}
            muted={muted()}
            onToggleSound={() => setMuted(!muted())}
            onLanguageChange={(lang) => {
              setUserLanguage(lang);
              fetchUserData(localStorage.getItem('etm_token') || '');
            }}
            t={t}
          />
        </Show>

        <Show when={!hasGameState()}>
          {/* Loading skeleton — unchanged */}
          <div class="h-full overflow-y-auto custom-scrollbar p-4 pb-20">
            <div class="flex flex-col h-full">
              <header class="mb-2 flex-shrink-0">
                <div class="grid grid-cols-5 gap-1.5">
                  {[1, 2, 3, 4, 5].map(() => (
                    <div class="glass-premium rounded-lg p-1.5 text-center animate-pulse">
                      <div class="h-2 w-10 bg-white/40 rounded mx-auto mb-1" />
                      <div class="h-5 w-14 bg-white/40 rounded mx-auto" />
                    </div>
                  ))}
                </div>
              </header>
              <div class="flex flex-1 gap-3 min-h-0">
                <div class="w-[40%] h-full">
                  <div class="glass-premium p-2 h-full">
                    <div class="grid grid-cols-5 gap-0.5 h-full">
                      {['B', 'I', 'N', 'G', 'O'].map(() => (
                        <div class="flex flex-col items-center h-full">
                          <div class="w-full text-center rounded-md mb-1 h-5 bg-white/40 animate-pulse" />
                          <div class="flex flex-col gap-0.5 w-full flex-1">
                            {Array.from({ length: 15 }).map(() => (
                              <div class="flex-1 bg-white/30 rounded animate-pulse" />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div class="w-[56%] flex flex-col gap-3 h-full">
                  <div class="glass-premium p-2 flex-shrink-0">
                    <div class="flex flex-col gap-2">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-1.5">
                          <div class="w-1.5 h-1.5 rounded-full bg-gray-500 animate-pulse" />
                          <div class="h-3 w-20 bg-white/40 rounded animate-pulse" />
                        </div>
                        <div class="h-3 w-12 bg-white/40 rounded animate-pulse" />
                      </div>
                      <div class="flex items-center justify-between bg-white/10 rounded-xl px-3 py-2">
                        <div class="h-3 w-16 bg-white/40 rounded animate-pulse" />
                        <div class="flex items-center gap-3">
                          <div class="h-5 w-5 bg-white/40 rounded animate-pulse" />
                          <div class="w-12 h-12 rounded-full bg-white/40 animate-pulse" />
                        </div>
                      </div>
                      <div class="flex justify-end gap-3">
                        {[1, 2, 3].map(() => (
                          <div class="flex flex-col items-center">
                            <div class="h-2 w-3 bg-white/40 rounded animate-pulse mb-1" />
                            <div class="w-9 h-9 rounded-full bg-white/40 animate-pulse" />
                          </div>
                        ))}
                      </div>
                      <div class="mt-1 pt-1 border-t border-white/20 flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <div class="w-4 h-4 bg-white/40 rounded animate-pulse" />
                          <div class="h-3 w-16 bg-white/40 rounded animate-pulse" />
                          <div class="h-4 w-16 bg-white/40 rounded-full animate-pulse" />
                        </div>
                        <div class="w-9 h-5 bg-white/40 rounded-full animate-pulse" />
                      </div>
                    </div>
                  </div>
                  <div class="flex-1 min-h-0">
                    <div class="glass-premium p-3 flex flex-col h-full">
                      <div class="h-3 w-24 bg-white/40 rounded animate-pulse mb-2" />
                      <div class="grid grid-cols-5 gap-1 flex-1">
                        {Array.from({ length: 25 }).map(() => (
                          <div class="aspect-square bg-white/30 rounded animate-pulse" />
                        ))}
                      </div>
                      <div class="mt-2 h-6 w-full bg-white/30 rounded animate-pulse" />
                    </div>
                  </div>
                  <div class="w-full h-10 bg-white/40 rounded-xl animate-pulse flex-shrink-0" />
                </div>
              </div>
            </div>
          </div>
        </Show>
      </div>

      <BottomNav active={currentMainTab()} onSelect={(tab) => setCurrentMainTab(tab)} t={t} />
       {/* Pending Transaction Indicator – compact circle */}
<Show when={pendingTx()}>
  <div
    class="fixed bottom-4 right-4 z-[300] cursor-pointer"
    onClick={() => setShowPendingModal(true)}
  >
    <div class="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center relative shadow-lg shadow-indigo-500/10">
      <svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <div class="absolute inset-0 rounded-full border-2 border-indigo-500/40 animate-ping" />
    </div>
  </div>
</Show>

{/* Pending Transaction Detail Modal */}
<Show when={showPendingModal() && pendingTx()}>
  <div class="fixed inset-0 z-[600] flex items-center justify-center bg-black/80 backdrop-blur-md" onClick={() => setShowPendingModal(false)}>
    <div class="glass-premium w-80 p-5 rounded-2xl border border-tina-gold/20" onClick={(e) => e.stopPropagation()}>
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-xl bg-tina-gold/20 flex items-center justify-center text-tina-gold">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <h3 class="text-lg font-black text-white uppercase">
          {pendingTx()!.type === 'deposit' ? 'Deposit Pending' : 'Withdrawal Pending'}
        </h3>
      </div>
      <div class="space-y-3 text-sm">
        <div class="flex justify-between py-2 border-b border-white/10">
          <span class="text-gray-400">Amount</span>
          <span class="font-bold text-white">{pendingTx()!.amount} ETB</span>
        </div>
        <div class="flex justify-between py-2 border-b border-white/10">
          <span class="text-gray-400">Request ID</span>
          <span class="text-xs font-mono text-gray-300">{pendingTx()!.requestId}</span>
        </div>
        {pendingTx()!.type === 'withdraw' && pendingTx()!.destination && (
          <div class="flex justify-between py-2 border-b border-white/10">
            <span class="text-gray-400">To</span>
            <span class="text-white">{pendingTx()!.destination}</span>
          </div>
        )}
        <div class="flex items-center gap-2 bg-white/5 rounded-lg p-3 mt-2">
          <div class="w-4 h-4 border-2 border-tina-gold border-t-transparent rounded-full animate-spin" />
          <span class="text-gray-400 text-xs">Awaiting admin confirmation</span>
        </div>
      </div>
      <button onClick={() => setShowPendingModal(false)} class="w-full mt-4 py-3 rounded-xl bg-tina-gold text-black font-black uppercase text-sm">Close</button>
    </div>
  </div>
</Show>

{/* ══════════════ SHAMO BADGE + POPUP ══════════════ */}
<Show when={!activePopup() && !showPendingModal()}>
  <ShamoBadge
    active={true}
    countdownSeconds={shamoState() ? 0 : shamoCountdownSec()}
    isLive={!!shamoState()}
    onOpen={() => setShowShamo(true)}
  />
</Show>

<Show when={showShamo()}>
  <ShamoPopup
    state={shamoState()}
    canClaim={!!shamoState()}
    countdownSeconds={shamoCountdownSec()}
    onClaim={handleShamoClaim}
    onClose={() => setShowShamo(false)}
    t={t}
  />
</Show>

    <Show when={activePopup() === 'wallet'}>
      <WalletPopup
        balanceETB={balance()}
        balanceMain={userBalances().main}
        lockedBalance={userBalances().locked}
        isAgent={isAgent()}                             
        token={localStorage.getItem('etm_token') || ''}
        onClose={() => setActivePopup(null)}
        onBalanceRefresh={() => fetchUserData(localStorage.getItem('etm_token') || '')}
        t={t}
      />
    </Show>

      <Show when={activePopup() === 'invite'}>
        <InvitePopup
          userId={userId()}
          token={localStorage.getItem('etm_token') || ''}
          referralData={referralData()}
          loading={loadingReferral()}
          onClose={() => setActivePopup(null)}
          t={t}
        />
      </Show>

      <SessionExpiredPopup
        show={showSessionExpiredPopup()}
        onClose={() => {
          setShowSessionExpiredPopup(false);
          setSessionExpired(false);
        }}
      />
      <NetworkPopup
        show={showNetworkPopup()}
        reason={deviceOffline() ? 'device' : 'server'}
        onRetry={() => {
          if (!deviceOffline()) {
            setShowNetworkPopup(false);
            connect();
          }
        }}
        onClose={() => setShowNetworkPopup(false)}
      />
      <DuplicateSessionPopup
        show={showDuplicatePopup()}
        onClose={() => setShowDuplicatePopup(false)}
      />
      <Show when={winners() && phase() === 'winner'}>
        <WinnerPopup
          winners={winners()!}
          drawnBalls={winnerDrawnBalls()}
          onClose={() => {
            setPhase('selection');
            setWinners(null);
            setWinnerCardData(null);
          }}
        />
      </Show>
    </div>
  );
}

function getBingoLetter(num: number): string {
  if (num <= 15) return 'B';
  if (num <= 30) return 'I';
  if (num <= 45) return 'N';
  if (num <= 60) return 'G';
  return 'O';
}

function getBallColorClass(num: number): string {
  if (num <= 15) return 'bg-tina-blue';
  if (num <= 30) return 'bg-tina-purple';
  if (num <= 45) return 'bg-tina-berry';
  if (num <= 60) return 'bg-tina-leaf';
  return 'bg-tina-orange';
}