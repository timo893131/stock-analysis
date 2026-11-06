"""Curated research coverage, not investment recommendations."""
FOCUS = [
 ('2330.TW','台積電','tech'),('2317.TW','鴻海','tech'),('2454.TW','聯發科','tech'),('2308.TW','台達電','tech'),
 ('2881.TW','富邦金','finance'),('0050.TW','元大台灣50','etf'),
 ('2303.TW','聯電','tech'),('3711.TW','日月光投控','tech'),('2382.TW','廣達','tech'),('3231.TW','緯創','tech'),
 ('2357.TW','華碩','tech'),('2379.TW','瑞昱','tech'),('3034.TW','聯詠','tech'),('2345.TW','智邦','tech'),
 ('2882.TW','國泰金','finance'),('2891.TW','中信金','finance'),('0056.TW','元大高股息','etf'),('00878.TW','國泰永續高股息','etf'),
 ('6488.TWO','環球晶','tech'),('8069.TWO','元太','tech')]
STOCKS = {symbol:name for symbol,name,sector in FOCUS}
SECTORS = {symbol:sector for symbol,name,sector in FOCUS}
AI_SYMBOLS = [symbol for symbol,_,_ in FOCUS[:6]]
