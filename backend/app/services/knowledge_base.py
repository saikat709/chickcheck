"""Curated RAG Knowledge Base for Poultry Farm Intelligence & Veterinary Management.

Contains domain knowledge for ChickCheck metrics, poultry diseases, vaccination
schedules, heat stress protocols, brooding guidelines, and biosecurity in both
English and Bengali.
"""

from typing import List, Dict, Any
import re


POULTRY_KNOWLEDGE_BASE: List[Dict[str, Any]] = [
    {
        "id": "chickcheck_metrics",
        "category": "system_metrics",
        "title_en": "ChickCheck Flock Health Index & Kinematic Scoring",
        "title_bn": "চিকচেক ফ্লক স্বাস্থ্য সূচক ও কাইনেম্যাটিক স্কোরিং",
        "tags": [
            "health score", "status", "healthy", "watch", "alert", "kinematics",
            "speed", "activity index", "স্বাস্থ্যের স্কোর", "স্ট্যাটাস", "গতি", "সতর্কতা"
        ],
        "content_en": (
            "ChickCheck evaluates poultry health based on computer-vision kinematics.\n"
            "- Healthy (Score 80-100): Birds exhibit normal active foraging, steady movement, and natural dispersion.\n"
            "- Watch (Score 50-79): Mild reduction in activity or occasional clustering. Monitor ventilation, temperature, and water lines.\n"
            "- Critical Alert (Score < 50): Significant flock lethargy, prolonged immobility, or severe abnormal clustering. Immediate shed inspection required.\n"
            "Key metrics tracked: individual normalized speed (body lengths/s), flock activity index (0-100), spatial dispersion, and crowd density."
        ),
        "content_bn": (
            "চিকচেক কম্পিউটার ভিশন ও কাইনেম্যাটিক্স ব্যবহার করে মুরগির স্বাস্থ্য বিশ্লেষণ করে।\n"
            "- স্বাস্থ্যবান (স্কোর ৮০-১০০): মুরগি স্বাভাবিক চলাচল, খাবার খোঁজা ও ছড়িয়ে ছিটিয়ে থাকে।\n"
            "- পর্যবেক্ষণ / ওয়াচ (স্কোর ৫০-৭৯): চলাচলের মাত্রা কিছুটা কমে যাওয়া বা হালকা জড়ো হওয়া। বাতাস ও পানি চেক করুন।\n"
            "- সংকটজনক সতর্কতা / অ্যালার্ট (স্কোর < ৫০): অস্বাভাবিক নিস্তেজতা, দীর্ঘদিন নড়াচড়া না করা বা অতিরিক্ত জড়ো হওয়া। জরুরি শেড পরিদর্শন প্রয়োজন।"
        ),
    },
    {
        "id": "thermal_huddling",
        "category": "behavior",
        "title_en": "Thermal Huddling & Cold Stress Clustering",
        "title_bn": "ঠান্ডায় মুরগির জড়ো হওয়া (হাডলিং) ও প্রতিকার",
        "tags": [
            "huddling", "clustering", "cold stress", "brooding", "temperature", "crowding",
            "হাডলিং", "জড়ো হওয়া", "ঠান্ডা", "ব্রুডিং তাপমাত্রা", "গাদাগাদি"
        ],
        "content_en": (
            "Thermal huddling occurs when birds tightly cluster together to conserve body heat.\n"
            "- Detection: ChickCheck triggers a Huddling Alert when spatial clustering coefficient exceeds 0.45 for > 2 minutes.\n"
            "- Causes: Drafts from broken curtains, failing brooders/heaters, cold wet litter, or sudden nighttime temperature drop.\n"
            "- Risks: Piling causes suffocation and crushing of bottom chicks, wet belly, and stunted growth.\n"
            "- Immediate Actions: Check thermometer at bird height. Increase brooder heat by 2-3°C. Block cold drafts while maintaining fresh air exchange. Gently disperse huddled piles to prevent suffocation."
        ),
        "content_bn": (
            "শীত বা ঠান্ডার কারণে মুরগি যখন গা ঘেঁষে স্তূপাকারে জড়ো হয় তাকে হাডলিং বলে।\n"
            "- সনাক্তকরণ: যখন ক্লাস্টারিং মান ০.৪৫ অতিক্রম করে ২ মিনিটের বেশি স্থায়ী হয়, তখন চিকচেক সতর্ক করে।\n"
            "- কারণ: ঘরের ভেতর ঠান্ডা বাতাস ঢোকা, ব্রুডার হিটারের তাপমাত্রা কমে যাওয়া, ভেজা লিটার বা হঠাৎ তাপমাত্রা পতন।\n"
            "- ঝুঁকি: ওপরের মুরগির চাপে নিচের মুরগি দমবন্ধ হয়ে মারা যেতে পারে (স্মোথারিং)।\n"
            "- করণীয়: মুরগির উচ্চতায় তাপমাত্রা মাপুন। ব্রুডারের তাপমাত্রা ২-৩ ডিগ্রি বাড়ান। সরাসরি ঠান্ডা বাতাস বন্ধ করুন এবং জড়ো হওয়া মুরগিদের আলতোভাবে ছড়িয়ে দিন।"
        ),
    },
    {
        "id": "immobile_screening",
        "category": "anomaly",
        "title_en": "Immobile Bird & Potential Mortality Screening",
        "title_bn": "নিষ্ক্রিয় বা মৃতপ্রায় পাখি সনাক্তকরণ ও ব্যবস্থা",
        "tags": [
            "immobile", "dead bird", "mortality", "idle", "culling", "lethargy", "paralysis",
            "নিষ্ক্রিয় পাখি", "মৃত মুরগি", "প্যারালাইসিস", "রোগাক্রান্ত", "আলাদা করা"
        ],
        "content_en": (
            "ChickCheck tracks continuous stationary intervals for every tagged bird.\n"
            "- Watch Trigger: A bird motionless for > 3 minutes is highlighted in orange.\n"
            "- Alert Trigger: Motionless for > 5 minutes highlights in red as a potential dead or moribund bird.\n"
            "- Common Causes: Severe systemic infection (Gumboro/Ranikhet), dehydration, lameness/rickets, or suffocation.\n"
            "- Biosecurity Protocol: Immediately isolate the immobile bird into a sick bay. If dead, remove immediately inside a sealed bag to prevent flock cannibalism and fly-borne contamination. Disinfect hands and footwear."
        ),
        "content_bn": (
            "চিকচেক প্রতিটি চিহ্নিত মুরগির স্থির থাকার সময় ট্র্যাক করে।\n"
            "- ওয়াচ স্ট্যাটাস: মুরগি ৩ মিনিটের বেশি এক জায়গায় স্থির থাকলে কমলা রঙে চিহ্নিত হয়।\n"
            "- অ্যালার্ট স্ট্যাটাস: ৫ মিনিটের বেশি স্থির থাকলে লাল রঙে সম্ভাব্য মৃত বা মারাত্মক অসুস্থ হিসেবে সতর্ক করে।\n"
            "- কারণ: মারাত্মক ইনফেকশন (রানিখেত/গামবোরো), পানিশূন্যতা, পায়ে আঘাত বা প্যারালাইসিস।\n"
            "- বায়োসিকিউরিটি নিয়ম: অসুস্থ মুরগি তৎক্ষণাৎ আলাদা করুন। মারা গেলে দ্রুত সিল করা ব্যাগে শেড থেকে বের করে মাটিচাপা দিন।"
        ),
    },
    {
        "id": "heat_stress_management",
        "category": "environment",
        "title_en": "Heat Stress Prevention & Emergency Management",
        "title_bn": "হিট স্ট্রোক ও অতিরিক্ত গরম প্রতিরোধে করণীয়",
        "tags": [
            "heat stress", "panting", "summer", "temperature", "ventilation", "vitamin c", "electrolytes",
            "হিট স্ট্রোক", "হাঁপানো", "অতিরিক্ত গরম", "ইলেক্ট্রোলাইট", "ভিটামিন সি", "ফ্যান"
        ],
        "content_en": (
            "Poultry have no sweat glands and suffer severe heat stress when shed temperature exceeds 30°C (86°F), especially with high humidity.\n"
            "- Warning Signs: Rapid panting with open beak, wings spread away from body, lethargy, decreased feed intake, increased water consumption.\n"
            "- Emergency Steps:\n"
            "  1. Water: Supply cool, fresh drinking water (15-20°C). Add Electrolytes and Vitamin C (1g/2-3L of water) in the morning.\n"
            "  2. Ventilation: Maximize fan airflow. Wet exterior roof or use foggers/sprinklers if relative humidity is below 70%.\n"
            "  3. Feeding: Withhold feed during the hottest hours (11:00 AM - 4:00 PM) to avoid metabolic heat load; feed early morning and night.\n"
            "  4. Density: Lower stocking density to ensure birds have space to dissipate radiant heat."
        ),
        "content_bn": (
            "মুরগির শরীরে ঘাম গ্রন্থি নেই, তাই তাপমাত্রা ৩০ ডিগ্রি সেলসিয়াসের বেশি হলে মারাত্মক হিট স্ট্রেস দেখা দেয়।\n"
            "- প্রধান লক্ষণ: মুখ হাঁ করে দ্রুত শ্বাস নেওয়া, ডানা ছড়িয়ে বসে থাকা, নিস্তেজ হয়ে যাওয়া, খাওয়া বন্ধ করে প্রচুর পানি খাওয়া।\n"
            "- জরুরি পদক্ষেপ:\n"
            "  ১. পানি: সব সময় ঠান্ডা ও পরিষ্কার পানি দিন। সকালে পানিতে ভিটামিন-সি ও স্যালাইন/ইলেক্ট্রোলাইট মিশিয়ে দিন।\n"
            "  ২. বায়ু চলাচল: ফ্যান সম্পূর্ণ চালু রাখুন। ছাউনির ওপর পানি ছিটান।\n"
            "  ৩. খাদ্য ব্যবস্থাপনা: তীব্র রোদের সময় (সকাল ১১টা থেকে বিকেল ৪টা) খাবার বন্ধ রাখুন; সকালের শুরুতে বা সন্ধ্যায় খাবার দিন।\n"
            "  ৪. ঘনত্ব: শেডে মুরগির ঘনত্ব কমিয়ে দিন যাতে বাতাস চলাচল করতে পারে।"
        ),
    },
    {
        "id": "brooding_temperature",
        "category": "brooding",
        "title_en": "Brooding Temperature & Humidity Management Guide",
        "title_bn": "বাচ্চা ব্রুডিং তাপমাত্রা ও আর্দ্রতা নির্দেশিকা",
        "tags": [
            "brooding", "chicks", "temperature schedule", "day old chicks", "humidity", "litter",
            "ব্রুডিং", "বাচ্চার তাপমাত্রা", "লিটার", "আর্দ্রতা", "১ দিনের বাচ্চা"
        ],
        "content_en": (
            "Optimal brooding temperature schedule (measured at chick height under the brooder):\n"
            "- Days 1 to 3: 33°C - 35°C (91°F - 95°F), Relative Humidity 60-70%\n"
            "- Days 4 to 7: 31°C - 33°C (88°F - 91°F)\n"
            "- Days 8 to 14: 29°C - 31°C (84°F - 88°F)\n"
            "- Days 15 to 21: 26°C - 28°C (79°F - 82°F)\n"
            "- Day 22+: 21°C - 24°C (70°F - 75°F)\n"
            "Chicks distribution behavior:\n"
            "- Evenly spaced & chirping softly: Perfect comfort.\n"
            "- Huddled under brooder: Too cold.\n"
            "- Scattered against walls & panting: Too hot.\n"
            "- Huddled in one corner: Draft or uneven lighting."
        ),
        "content_bn": (
            "বাচ্চার বয়স অনুযায়ী ব্রুডিং তাপমাত্রা তালিকা (বাচ্চার উচ্চতায় পরিমাপ্য):\n"
            "- দিন ১ থেকে ৩: ৩৩° - ৩৫° সেলসিয়াস, আর্দ্রতা ৬০-৭০%\n"
            "- দিন ৪ থেকে ৭: ৩১° - ৩৩° সেলসিয়াস\n"
            "- দিন ৮ থেকে ১৪: ২৯° - ৩১° সেলসিয়াস\n"
            "- দিন ১৫ থেকে ২১: ২৬° - ২৮° সেলসিয়াস\n"
            "- দিন ২২ থেকে বাজারজাত: ২১° - ২৪° সেলসিয়াস\n"
            "বাচ্চার আচরণ দেখে বুঝুন:\n"
            "- সমানভাবে ছড়িয়ে খেলা করছে: তাপমাত্রা একদম সঠিক।\n"
            "- ব্রুডারের নিচে গাদাগাদি করছে: অতিরিক্ত ঠান্ডা।\n"
            "- দেয়ালের কাছে সরে গিয়ে মুখ হাঁ করছে: অতিরিক্ত গরম।\n"
            "- একদিকে জড়ো হচ্ছে: একদিক থেকে ঠান্ডা বাতাস ঢুকছে।"
        ),
    },
    {
        "id": "newcastle_disease",
        "category": "disease",
        "title_en": "Newcastle Disease (Ranikhet) - Symptoms & Prevention",
        "title_bn": "রানিখেত রোগ (Newcastle Disease) - লক্ষণ ও প্রতিকার",
        "tags": [
            "ranikhet", "newcastle", "green diarrhea", "twisting neck", "respiratory", "vaccine",
            "রানিখেত", "সবুজ পায়খানা", "ঘাড় বাঁকা", "টিকা", "ভাইরাস"
        ],
        "content_en": (
            "Newcastle Disease (Ranikhet) is a highly contagious, deadly viral disease affecting poultry.\n"
            "- Key Symptoms: Bright greenish watery diarrhea, gasping/coughing, facial swelling, drooping wings, nervous signs like twisted neck (torticollis) and tremors.\n"
            "- Mortality: Can reach 80-100% in unvaccinated flocks within 3-5 days.\n"
            "- Treatment: No direct cure (viral). Provide broad-spectrum antibiotics to curb secondary bacterial infection, plus electrolytes and liver tonics.\n"
            "- Prevention: Strict vaccination schedule (BCRDV eye drop at Day 4-5, RDV booster at Day 21-24). Maintain rigorous foot baths and restrict farm visitors."
        ),
        "content_bn": (
            "রানিখেত একটি মারাত্মক সংক্রামক ভাইরাসজনিত রোগ যা দ্রুত পুরো খামারে ছড়িয়ে পড়ে।\n"
            "- প্রধান লক্ষণ: চুনের মত সাদা মেশানো উজ্জ্বল সবুজ পাতলা পায়খানা, ঘাড় বাঁকা হয়ে যাওয়া, চোখ-মুখ ফোলা, ঘড়ঘড় শব্দে শ্বাস নেওয়া ও ডানা ঝুলে পড়া।\n"
            "- মৃত্যুহার: টিকা না দেওয়া খামারে ৮০-১০০% পর্যন্ত হতে পারে।\n"
            "- চিকিৎসা: ভাইরাসের কোনো সরাসরি ওষুধ নেই। সেকেন্ডারি ব্যাকটেরিয়াল ইনফেকশন রোধে অ্যান্টিবায়োটিক, স্যালাইন ও ভিটামিন দেওয়া হয়।\n"
            "- প্রতিরোধ: সঠিক সময়ে টিকা দেওয়া (৪-৫ দিনে চোখে বিসিআরডিভি এবং ২১-২৪ দিনে আরডিভি)। খামারে কঠোর জীবাণুনাশক ব্যবহার।"
        ),
    },
    {
        "id": "gumboro_disease",
        "category": "disease",
        "title_en": "Infectious Bursal Disease (Gumboro) - Symptoms & Management",
        "title_bn": "গামবোরো রোগ (IBD) - লক্ষণ ও সতর্কতা",
        "tags": [
            "gumboro", "ibd", "white diarrhea", "ruffled feathers", "trembling", "bursa",
            "গামবোরো", "সাদা পায়খানা", "পাকস্থলি", "লোম খাড়া", "কাঁপুনি"
        ],
        "content_en": (
            "Gumboro (IBD) attacks the Bursa of Fabricius, destroying the bird's immune system.\n"
            "- Age Vulnerability: Most common in chicks between 2 to 6 weeks old.\n"
            "- Key Symptoms: Ruffled feathers, severe depression, whitish watery diarrhea, vent pecking, trembling, high spike in sudden mortality.\n"
            "- Prevention: Gumboro vaccine at Day 9-11 (drinking water), with booster dose at Day 17-19. Strict disinfection of shed and drinkers."
        ),
        "content_bn": (
            "গামবোরো একটি তীব্র ভাইরাসজনিত রোগ যা মুরগির রোগ প্রতিরোধ ক্ষমতা (বারসা) সম্পূর্ণ ধ্বংস করে দেয়।\n"
            "- আক্রমণের বয়স: সাধারণত ২ থেকে ৬ সপ্তাহ বয়সের বাচ্চার মধ্যে বেশি দেখা যায়।\n"
            "- প্রধান লক্ষণ: লোম খাড়া হয়ে যাওয়া, কাঁপতে কাঁপতে নিস্তেজ হয়ে পড়া, সাদা বা হলুদ পাতলা পায়খানা, মলদ্বারে ঠোকরানো ও হঠাৎ মৃত্যুহার বৃদ্ধি।\n"
            "- প্রতিরোধ: ৯-১১ দিনে প্রথম গামবোরো ভ্যাকসিন এবং ১৭-১৯ দিনে দ্বিতীয় বুস্টার ডোজ প্রদান। পানি বিশুদ্ধকরণ জীবাণুনাশক ব্যবহার।"
        ),
    },
    {
        "id": "coccidiosis",
        "category": "disease",
        "title_en": "Coccidiosis Management (Bloody Droppings & Wet Litter)",
        "title_bn": "রক্ত আমাশয় (কক্সিডিওসিস) - কারণ ও প্রতিকার",
        "tags": [
            "coccidiosis", "bloody droppings", "wet litter", "ammonia", "toltrazuril",
            "রক্ত আমাশয়", "কক্সিডিওসিস", "ভেজা লিটার", "রক্ত পায়খানা", "টোল্ট্রাজুরিল"
        ],
        "content_en": (
            "Coccidiosis is caused by protozoan parasites multiplying in the intestinal tract.\n"
            "- Trigger: Wet, caked litter with high moisture (>30%) and warmth promotes oocyst sporulation.\n"
            "- Symptoms: Red or blood-streaked droppings, huddling with ruffled feathers, pale combs/wattles, severe drop in feed intake.\n"
            "- Treatment: Administer anticoccidials (such as Toltrazuril or Amprolium) in drinking water per veterinary instructions. Provide Vitamin K to help control internal bleeding.\n"
            "- Management: Keep litter bone dry, rake frequently, fix leaking nipple drinkers, and change wet spots immediately."
        ),
        "content_bn": (
            "কক্সিডিওসিস বা রক্ত আমাশয় প্রোটোজোয়া পরজীবী ঘটিত অন্ত্রের রোগ।\n"
            "- প্রধান কারণ: স্যাঁতসেঁতে ভেজা লিটার ও অতিরিক্ত আর্দ্রতা।\n"
            "- প্রধান লক্ষণ: রক্তযুক্ত বা বাদামী রঙের পাতলা পায়খানা, মুরগি চোখ বুজে জিম ধরা, ফ্যাকাশে ঝুঁটি, খাওয়া হঠাৎ কমে যাওয়া।\n"
            "- চিকিৎসা: পশু চিকিৎসকের পরামর্শে পানিতে টোল্ট্রাজুরিল (Toltrazuril) বা অ্যাম্প্রোলিয়াম দেওয়া এবং রক্তক্ষরণ বন্ধে ভিটামিন-কে যোগ করা।\n"
            "- প্রতিকার: লিটার সব সময় শুকনো রাখা, নিপল ড্রিংকার থেকে পানি পড়া বন্ধ করা এবং ভেজা লিটার ফেলে দিয়ে নতুন শুকনো তুষ দেওয়া।"
        ),
    },
    {
        "id": "vaccination_schedule",
        "category": "vaccination",
        "title_en": "Standard Commercial Broiler Vaccination Schedule",
        "title_bn": "ব্রয়লার মুরগির আদর্শ টিকাদানের সময়সূচী",
        "tags": [
            "vaccination", "schedule", "bcrdv", "gumboro", "rdv", "marek", "টিকা", "ভ্যাকসিন শিডিউল", "বিসিআরডিভি"
        ],
        "content_en": (
            "Standard Commercial Broiler Vaccination Timeline:\n"
            "- Day 1 (Hatchery): Marek's Disease (Subcutaneous)\n"
            "- Day 4 to 5: Ranikhet / Newcastle (BCRDV) - 1 drop in one eye\n"
            "- Day 9 to 11: Gumboro (IBD Live) - In cool, chlorine-free drinking water with skim milk\n"
            "- Day 17 to 19: Gumboro Booster - In drinking water\n"
            "- Day 21 to 24: Ranikhet Booster (RDV) - In drinking water or subcutaneous\n"
            "Critical Vaccine Rules: Never vaccinate sick or stressed flocks. Use skim milk powder (2-2.5g/L) to neutralize traces of chlorine in water. Complete vaccination within 2 hours of mixing."
        ),
        "content_bn": (
            "ব্রয়লার মুরগির নিয়মিত টিকাদানের সময়সূচী:\n"
            "- ১ম দিন (হ্যাচারিতে): মেরেক্স রোগ ভ্যাকসিন\n"
            "- ৪র্থ - ৫ম দিন: রানিখেত (BCRDV) - চোখে ১ ফোঁটা\n"
            "- ৯ম - ১১তম দিন: গামবোরো (IBD) - ক্লোরিনমুক্ত পানিতে দুধ মিশিয়ে পান করানো\n"
            "- ১৭তম - ১৯তম দিন: গামবোরো বুস্টার ডোজ\n"
            "- ২১তম - ২৪তম দিন: রানিখেত বুস্টার (RDV)\n"
            "জরুরি সতর্কতা: অসুস্থ বা দুর্বল মুরগিকে কখনো টিকা দেবেন না। পানির ক্লোরিন দূর করতে প্রতি লিটার পানিতে ২-২.৫ গ্রাম স্কিম মিল্ক পাউডার মেশান। মিশ্রণের ২ ঘণ্টার মধ্যে পানি পান শেষ করতে হবে।"
        ),
    },
    {
        "id": "biosecurity_disinfection",
        "category": "biosecurity",
        "title_en": "Biosecurity, Footbaths & Shed Hygiene Protocols",
        "title_bn": "খামারের জীবাণুমুক্তকরণ ও বায়োসিকিউরিটি নিয়মাবলী",
        "tags": [
            "biosecurity", "disinfection", "footbath", "hygiene", "visitors", "spraying",
            "বায়োসিকিউরিটি", "জীবাণুনাশক", "ফুটবাথ", "পরিচ্ছন্নতা", "জীবাণু স্প্রে"
        ],
        "content_en": (
            "Biosecurity is the primary defense against catastrophic flock infections.\n"
            "- Farm Entrance: Maintain an active footbath with Virkon-S, bleaching powder, or iodophor solution. Change daily.\n"
            "- Dedicated Farm Clothing: Never enter sheds with street shoes or dirty clothes.\n"
            "- Water Sanitization: Chlorinate or acidify reservoir water to prevent bacterial biofilms (E. coli, Salmonella).\n"
            "- Rodent & Wild Bird Control: Seal shed wire mesh to prevent wild sparrows or rats from bringing Avian Influenza or Salmonella.\n"
            "- 'All-in, All-out': Thoroughly wash with detergent, flame floor, and let shed rest empty for 10-14 days between flock batches."
        ),
        "content_bn": (
            "বায়োসিকিউরিটি হল খামারকে মহামারীর হাত থেকে বাঁচানোর প্রথম দুর্গ।\n"
            "- প্রবেশমুখে ফুটবাথ: খামারের মূল ফটকে ও প্রতিটি শেডের মুখে ব্লিচিং বা ভারকন-এস মিশ্রিত ফুটবাথ রাখুন এবং প্রতিদিন পানি পরিবর্তন করুন।\n"
            "- নির্দিষ্ট পোশাক ও জুতো: বাইরের জুতো নিয়ে কখনোই মুরগির শেডে ঢুকবেন না।\n"
            "- পানির বিশুদ্ধতা: নিয়মিত পানিতে ব্লিচিং বা ওয়াটার স্যানিটাইজার ব্যবহার করুন (ই-কোলাই ও সালমোনেলা রোধে)।\n"
            "- পাখি ও ইঁদুর দমন: শেডের তারের জাল সুরক্ষিত রাখুন যাতে কবুতর, চড়ুই বা ইঁদুর প্রবেশ করতে না পারে।\n"
            "- ব্যাচ বিরতি: এক ব্যাচ বিক্রির পর শেড সম্পূর্ণ ধুয়ে জীবাণুমুক্ত করে কমপক্ষে ১০-১৪ দিন বিশ্রাম দিন।"
        ),
    },
]


def retrieve_relevant_knowledge(query: str, top_k: int = 3) -> List[Dict[str, Any]]:
    """Retrieve top-K most relevant knowledge articles for a user query.
    
    Uses tokenization, keyword overlap, and category relevance scoring
    across English and Bengali terms.
    """
    if not query:
        return POULTRY_KNOWLEDGE_BASE[:top_k]

    # Normalize query
    normalized = query.lower()
    query_tokens = set(re.findall(r"[\w\u0980-\u09FF]+", normalized))

    scored_articles = []
    for article in POULTRY_KNOWLEDGE_BASE:
        score = 0.0

        # Match tags (highest weight)
        for tag in article.get("tags", []):
            tag_lower = tag.lower()
            if tag_lower in normalized:
                score += 5.0
            for token in query_tokens:
                if token in tag_lower:
                    score += 2.0

        # Match titles
        title_en = article.get("title_en", "").lower()
        title_bn = article.get("title_bn", "")
        for token in query_tokens:
            if token in title_en:
                score += 3.0
            if token in title_bn:
                score += 3.0

        # Match content snippets
        content_en = article.get("content_en", "").lower()
        content_bn = article.get("content_bn", "")
        for token in query_tokens:
            if len(token) > 2:
                if token in content_en:
                    score += 0.8
                if token in content_bn:
                    score += 0.8

        if score > 0:
            scored_articles.append((score, article))

    # Sort descending by score
    scored_articles.sort(key=lambda x: x[0], reverse=True)

    results = [art for _, art in scored_articles[:top_k]]
    # Fallback to general metrics if no score matched
    if not results:
        results = [POULTRY_KNOWLEDGE_BASE[0], POULTRY_KNOWLEDGE_BASE[3]]

    return results
