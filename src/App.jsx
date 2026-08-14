import React, { useState, useEffect, useMemo } from "react";
import {
  Menu,
  Search,
  SlidersHorizontal,
  Settings,
  ChevronDown,
  ChevronsDown,
  ChevronRight,
  FolderOpen,
  Delete,
  LayoutGrid,
  Bookmark,
  Briefcase,
  BookText,
  IndianRupee,
  Leaf,
  Bell,
  Coins,
  LineChart,
  ArrowLeft,
  MessageSquare,
  Camera,
  ListChecks,
  BarChart3,
  Wallet,
  Flag,
  FileBarChart,
  PiggyBank,
  Repeat,
  Lightbulb,
  User,
  CheckCircle2,
  Pencil,
} from "lucide-react";
import logo from "./assets/loog.png";

/* ---------------------------------------------------------
   TOKENS — close cousin of the reference screens, not a
   pixel copy of the real brand: generic circular mark,
   placeholder identity, demo-only auth, genericized promo
   copy (no real broker name / registration numbers).
--------------------------------------------------------- */
const T = {
  ink: "#1A1A1A",
  sub: "#7A7A7A",
  accent: "#4C3B8C", // muted indigo/purple, analogous to reference links
  brand: "#1FA9D8", // generic teal-blue mark, distinct from real logo
  line: "#ECECEC",
  bg: "#FFFFFF",
  panel: "#F7F7FA",
  dotEmpty: "#E7E5F0",
  green: "#1E8E3E",
  red: "#D93025",
  pink: "#D6336C",
};

const inr = (n) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ---------------------------------------------------------
   DAILY VALUE ENGINE
   Portfolio/net-worth figures are derived from the date, not
   randomised on every render — same inputs always produce the
   same output for a given day, so refreshing the page doesn't
   change anything. Weekends reuse Friday's value (no market
   movement Sat/Sun) and it only changes when the effective
   date actually rolls over.
--------------------------------------------------------- */
const BANK_BALANCE = 608239.47; // fixed portion of net worth outside the portfolio
const INVESTMENT_VALUE = 99994.56; // amount originally invested — fixed; portfolio value drifts around this

function hashStringToRng(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function getEffectiveDateKey(d) {
  const day = d.getDay(); // 0 = Sun, 6 = Sat
  const copy = new Date(d);
  if (day === 6) copy.setDate(copy.getDate() - 1); // Saturday -> Friday's value
  if (day === 0) copy.setDate(copy.getDate() - 2); // Sunday -> Friday's value
  return copy.toISOString().slice(0, 10);
}

function useDailyPortfolio() {
  const [dateKey, setDateKey] = useState(() => getEffectiveDateKey(new Date()));

  useEffect(() => {
    // Checks once a minute; the value itself only changes when
    // the effective date changes, i.e. right after midnight.
    const id = setInterval(() => {
      const k = getEffectiveDateKey(new Date());
      setDateKey((prev) => (prev !== k ? k : prev));
    }, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return useMemo(() => {
    const rand = hashStringToRng(dateKey);
    const drift = (rand() - 0.42) * 0.06; // ~ -2.5% to +3.5%, deterministic per day
    const currentValue = INVESTMENT_VALUE * (1 + drift);
    const unrealizedPnl = currentValue - INVESTMENT_VALUE;
    const unrealizedPct = (unrealizedPnl / INVESTMENT_VALUE) * 100;

    const dayDrift = (rand() - 0.5) * 0.03; // second draw, seeded off the same day
    const todaysPnl = currentValue * dayDrift;
    const todaysPct = dayDrift * 100;

    const netWorth = BANK_BALANCE + currentValue;

    return {
      dateKey,
      currentValue,
      investmentValue: INVESTMENT_VALUE,
      unrealizedPnl,
      unrealizedPct,
      todaysPnl,
      todaysPct,
      netWorth,
    };
  }, [dateKey]);
}

/* ---------------------------------------------------------
   LIVE INDEX DATA — NIFTY 50 / BANKNIFTY via Yahoo Finance's
   public chart endpoint. Yahoo doesn't send CORS headers for
   browser-side fetches, so this goes through a public CORS
   proxy (allorigins). If a fetch fails (offline, proxy down,
   market closed with no fresh tick, rate-limited) it falls
   back to the last good value and flags itself as such rather
   than silently showing stale numbers as if they were live.
--------------------------------------------------------- */
const YAHOO_SYMBOLS = { "NIFTY 50": "%5ENSEI", BANKNIFTY: "%5ENSEBANK" };

async function fetchYahooQuote(symbol) {
  const target = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
  const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`;
  const res = await fetch(proxied);
  if (!res.ok) throw new Error("bad response");
  const json = await res.json();
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta || typeof meta.regularMarketPrice !== "number") throw new Error("no data");
  const price = meta.regularMarketPrice;
  const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? price;
  const change = price - prevClose;
  return { price, change, pct: (change / prevClose) * 100 };
}

function useLiveIndices(pollMs = 60000) {
  const [state, setState] = useState({
    status: "loading", // loading | live | fallback
    data: {
      "NIFTY 50": { price: 24583.8, change: 13.15, pct: 0.05 },
      BANKNIFTY: { price: 57686.95, change: -59.5, pct: -0.1 },
    },
  });

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const entries = await Promise.all(
          Object.entries(YAHOO_SYMBOLS).map(async ([label, sym]) => [label, await fetchYahooQuote(sym)])
        );
        if (cancelled) return;
        setState((prev) => ({ status: "live", data: { ...prev.data, ...Object.fromEntries(entries) } }));
      } catch (e) {
        if (cancelled) return;
        setState((prev) => ({ status: "fallback", data: prev.data }));
      }
    }

    poll();
    const id = setInterval(poll, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pollMs]);

  return state;
}

/* ---------------------------------------------------------
   SCREEN 1 — MPIN entry (demo auth: any 6 digits proceeds)
--------------------------------------------------------- */
const APP_PIN = "311258"; // the only PIN this personal, single-device app accepts

function MpinScreen({ onUnlock }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const press = (d) => {
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    setError(false);

    if (next.length === 6) {
      if (next === APP_PIN) {
        setTimeout(() => onUnlock(), 220);
      } else {
        setShake(true);
        setError(true);
        setTimeout(() => {
          setShake(false);
          setPin("");
        }, 500);
      }
    }
  };
  const backspace = () => {
    setPin((p) => p.slice(0, -1));
    setError(false);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: T.bg }}>
      <div className="px-6 pt-8">
        <img src={logo} alt="Logo" className="w-14 h-14 rounded-full object-cover" /> 

        <h1 className="mt-6 leading-tight" style={{ color: T.ink }}>
  <span className="text-[24px] font-bold block">Welcome</span>
  <span className="text-[24px] font-bold block">Shrikant</span>
  <span className="text-[24px] font-bold block">Shriniwas Bhise</span>
</h1>
        <p className="mt-2 text-[13px]" style={{ color: T.sub }}>
          For secure and instant access, enter your 6 digit MPIN
        </p>
      </div>

      <div className="flex-1 flex flex-col items-center pt-10">
        <span className="text-[13px] font-medium" style={{ color: T.ink }}>
          Enter MPIN
        </span>
        <div className={`flex gap-3 mt-4 ${shake ? "animate-[shake_0.4s]" : ""}`}>
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[15px] font-semibold transition-colors"
              style={{
                background: error ? T.red : i < pin.length ? T.accent : T.dotEmpty,
                color: error || i < pin.length ? "#fff" : "transparent",
              }}
            >
              •
            </span>
          ))}
        </div>
        <style>{`@keyframes shake { 10%, 90% { transform: translateX(-2px); } 20%, 80% { transform: translateX(4px); } 30%, 50%, 70% { transform: translateX(-8px); } 40%, 60% { transform: translateX(8px); } }`}</style>
        {error && (
          <p className="mt-3 text-[12.5px] font-medium" style={{ color: T.red }}>
            Wrong PIN. Please try again.
          </p>
        )}
        <button className="mt-5 text-[13px] font-medium underline" style={{ color: T.accent }}>
          Forgot MPIN?
        </button>

        <div className="grid grid-cols-3 gap-x-8 gap-y-3 mt-10 px-8 w-full max-w-[300px]">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              onClick={() => press(d)}
              className="h-12 rounded-full text-[19px] font-medium"
              style={{ color: T.ink }}
            >
              {d}
            </button>
          ))}
          <span />
          <button onClick={() => press("0")} className="h-12 rounded-full text-[19px] font-medium" style={{ color: T.ink }}>
            0
          </button>
          <button onClick={backspace} className="h-12 rounded-full flex items-center justify-center" style={{ color: T.ink }}>
            <Delete size={19} />
          </button>
        </div>
      </div>

      <div className="text-center pb-4">
        <div className="text-[11px]" style={{ color: T.sub }}>
          v 1.0.70
        </div>
        <button className="text-[11px] underline mt-0.5" style={{ color: T.accent }}>
          Disclaimer
        </button>
      </div>

      <div className="px-6 py-4 flex items-center justify-between" style={{ background: T.accent }}>
        <div>
          <div className="text-[11px]" style={{ color: "#D9D2EE" }}>
            Use another
          </div>
          <div className="text-[14px] font-semibold text-white">Account</div>
        </div>
        <div className="w-6 h-6 rounded-full border border-white/60" />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Shared: header + tab strip used by Watchlist & Portfolio
--------------------------------------------------------- */
function AppHeader({ title, onMenuClick }) {
  return (
    <div className="shrink-0" style={{ background: T.panel }}>
      <div className="flex justify-center pt-1.5">
        <ChevronsDown size={14} style={{ color: T.accent }} />
      </div>
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-3">
          <button onClick={onMenuClick}>
            <Menu size={19} style={{ color: T.ink }} />
          </button>
          <span className="text-[16px] font-bold" style={{ color: T.ink }}>
            {title}
          </span>
        </div>
        <Bell size={19} style={{ color: T.ink }} />
      </div>
    </div>
  );
}

function PortfolioTabStrip({ active }) {
  const tabs = ["Overview", "Demat Balance", "Unsettled Stocks"];
  return (
    <div className="shrink-0 flex items-center gap-6 px-4 pt-1 pb-2" style={{ background: T.panel }}>
      {tabs.map((t) => (
        <span
          key={t}
          className="text-[13.5px] pb-1.5"
          style={{
            color: t === active ? T.accent : "#9A9A9A",
            fontWeight: t === active ? 600 : 400,
            borderBottom: t === active ? `2px solid ${T.accent}` : "2px solid transparent",
          }}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------
   SCREEN — Portfolio (Overview), scrollable
--------------------------------------------------------- */
function PortfolioScreen({ onMenuClick }) {
  const { currentValue, investmentValue, unrealizedPnl, unrealizedPct, todaysPnl, todaysPct } =
    useDailyPortfolio();

  return (
    <div className="flex flex-col h-full">
      <AppHeader title="Investment Portfolio" onMenuClick={onMenuClick} />
      <PortfolioTabStrip active="Overview" />

      <div className="flex-1 overflow-y-auto">
        {/* Portfolio value card */}
        <div
          className="mx-4 mt-3 rounded-xl p-6 relative overflow-hidden text-center"
          style={{ background: `linear-gradient(135deg, ${T.accent} 0%, #6552AE 100%)` }}
        >
          <div
            className="absolute -right-6 -top-10 w-32 h-32 rounded-full"
            style={{ background: "rgba(255,255,255,0.06)" }}
          />
          <div
            className="absolute -left-8 bottom-0 w-24 h-24 rounded-full"
            style={{ background: "rgba(255,255,255,0.06)" }}
          />
          <div className="relative">
            <div className="text-[13px]" style={{ color: "#E1DAF3" }}>
              Portfolio Value
            </div>
            <div className="text-[28px] font-bold text-white mt-1">{inr(currentValue)}</div>
            <div className="text-[12.5px] mt-4" style={{ color: "#E1DAF3" }}>
              Investment Value
            </div>
            <div className="text-[16px] font-semibold text-white mt-0.5">{inr(investmentValue)}</div>
          </div>
        </div>

        {/* P&L row */}
        <div className="mx-4 rounded-b-xl border border-t-0 grid grid-cols-3 divide-x" style={{ borderColor: T.line }}>
          {[
            {
              label: "Unrealized P&L",
              value: `${unrealizedPnl < 0 ? "-" : ""}${inr(Math.abs(unrealizedPnl)).replace("₹", "")}`,
              pct: Math.abs(unrealizedPct).toFixed(2),
              positive: unrealizedPnl >= 0,
            },
            {
              label: "Today's P&L",
              value: `${todaysPnl < 0 ? "-" : ""}${inr(Math.abs(todaysPnl)).replace("₹", "")}`,
              pct: Math.abs(todaysPct).toFixed(2),
              positive: todaysPnl >= 0,
            },
            { label: "Realised P&L", value: "--", pct: null, positive: null },
          ].map((c) => (
            <div key={c.label} className="py-3 px-2 text-center">
              <div className="text-[10.5px]" style={{ color: T.sub }}>
                {c.label}
              </div>
              <div
                className="text-[13px] font-semibold mt-1"
                style={{ color: c.positive === null ? T.sub : c.positive ? T.green : T.red }}
              >
                {c.value}
              </div>
              {c.pct && (
                <div className="text-[11px]" style={{ color: c.positive ? T.green : T.red }}>
                  ({c.pct}%)
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Promo banner — generic copy, no real broker name/registration numbers */}
        <div className="mx-4 mt-4 rounded-lg p-3.5 relative overflow-hidden" style={{ background: "#EAF2FB" }}>
          <div className="flex items-center justify-between">
            <div className="max-w-[62%]">
              <div className="text-[15px] font-bold leading-tight" style={{ color: T.accent }}>
                Streamline Your
                <br />
                Tax Filing Today
              </div>
              <div className="text-[10.5px] mt-1.5" style={{ color: T.ink }}>
                Access your <span className="font-semibold">Capital Gain &amp; Loss Report</span>
              </div>
              <button
                className="mt-2 px-3.5 py-1.5 rounded-md text-[10.5px] font-semibold text-white"
                style={{ background: T.pink }}
              >
                Access Now
              </button>
            </div>
            <LineChart size={54} strokeWidth={1.3} style={{ color: T.accent, opacity: 0.55 }} />
          </div>
          <p className="text-[8px] mt-2.5 leading-snug" style={{ color: T.sub }}>
            Disclaimer: Investment in securities markets is subject to market risks; read all related
            documents carefully before investing. This is a demo screen created for prototype and
            educational purposes only and is not associated with any real broker or account.
          </p>
        </div>

        <div className="px-4 pt-2 pb-1">
          <button className="text-[12.5px] font-medium underline" style={{ color: T.accent }}>
            See My Derivatives Portfolio
          </button>
        </div>

        {/* EQUITY — empty state */}
        <div className="mx-4 mt-3 rounded-xl border" style={{ borderColor: T.line }}>
          <div className="px-4 py-3">
            <span className="text-[12px] font-bold tracking-wide" style={{ color: T.ink }}>
              EQUITY
            </span>
          </div>
          <div className="h-px" style={{ background: T.line }} />
          <div className="px-4 py-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-semibold leading-snug" style={{ color: T.ink }}>
                You don't have equity holdings yet
              </p>
              <p className="text-[12px] mt-1" style={{ color: T.sub }}>
                Place an order from your watchlist to build your portfolio
              </p>
              <button className="text-[12.5px] font-semibold mt-2" style={{ color: T.accent }}>
                Place new order
              </button>
            </div>
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 border-2"
              style={{ borderColor: T.accent }}
            >
              <Coins size={22} style={{ color: T.accent }} />
            </div>
          </div>
        </div>

        {/* MUTUAL FUNDS */}
        <div className="mx-4 mt-3 mb-4 rounded-xl border overflow-hidden" style={{ borderColor: T.line, borderBottomColor: T.green, borderBottomWidth: 3 }}>
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-[12px] font-bold tracking-wide" style={{ color: T.ink }}>
              MUTUAL FUNDS
            </span>
            <ChevronRight size={16} style={{ color: T.sub }} />
          </div>
          <div className="h-px" style={{ background: T.line }} />
          <div className="px-4 py-3 flex items-start justify-between">
            <div>
              <div className="text-[11px]" style={{ color: T.sub }}>
                Current Value
              </div>
              <div className="text-[17px] font-bold mt-0.5" style={{ color: T.ink }}>
                {inr(currentValue)}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: T.sub }}>
                {inr(investmentValue)} (Investment Value)
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px]" style={{ color: T.sub }}>
                Today's P&L
              </div>
              <div className="text-[13px] font-semibold mt-0.5" style={{ color: todaysPnl >= 0 ? T.green : T.red }}>
                {todaysPnl < 0 ? "-" : ""}
                {inr(Math.abs(todaysPnl)).replace("₹", "")}
              </div>
              <div className="text-[11px]" style={{ color: todaysPnl >= 0 ? T.green : T.red }}>
                ({Math.abs(todaysPct).toFixed(2)}%)
              </div>
            </div>
          </div>
          <div className="mx-4 mb-3 rounded-md px-3 py-2 flex items-center justify-between" style={{ background: "#F2EFFA" }}>
            <span className="text-[11.5px]" style={{ color: T.ink }}>
              Unlock <span className="font-semibold">₹{(currentValue * 0.88).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span> for trading
            </span>
            <span className="text-[11.5px] font-semibold underline" style={{ color: T.accent }}>
              Pledge Now
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function useTypewriter(words, { typeMs = 90, pauseMs = 1400, deleteMs = 45, gapMs = 400 } = {}) {
  const [text, setText] = useState("");
  const list = Array.isArray(words) ? words : [words];

  useEffect(() => {
    let wordIdx = 0;
    let i = 0;
    let deleting = false;
    let timeoutId;

    const tick = () => {
      const word = list[wordIdx];
      if (!deleting) {
        i += 1;
        setText(word.slice(0, i));
        if (i >= word.length) {
          deleting = true;
          timeoutId = setTimeout(tick, pauseMs);
          return;
        }
        timeoutId = setTimeout(tick, typeMs);
      } else {
        i -= 1;
        setText(word.slice(0, i));
        if (i <= 0) {
          deleting = false;
          wordIdx = (wordIdx + 1) % list.length;
          timeoutId = setTimeout(tick, gapMs);
          return;
        }
        timeoutId = setTimeout(tick, deleteMs);
      }
    };

    timeoutId = setTimeout(tick, typeMs);
    return () => clearTimeout(timeoutId);
  }, [JSON.stringify(list), typeMs, pauseMs, deleteMs, gapMs]);

  return text;
}

/* ---------------------------------------------------------
   SCREEN — Watchlist landing (empty state)
--------------------------------------------------------- */
function WatchlistScreen({ onMenuClick }) {
  const { status, data } = useLiveIndices();
  const typed = useTypewriter(["Mutual Funds", "Stocks", "Indices"]);
  const nifty = data["NIFTY 50"];
  const bankNifty = data.BANKNIFTY;
  const niftyUp = nifty.change >= 0;
  const bankUp = bankNifty.change >= 0;

  return (
    <div className="flex flex-col h-full" style={{ background: T.bg }}>
      <div className="flex border-b" style={{ borderColor: T.line }}>
        <div className="flex-1 px-4 py-2.5 border-r" style={{ borderColor: T.line }}>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium tracking-wide" style={{ color: T.sub }}>
              NIFTY 50
            </span>
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: status === "live" ? T.green : "#C7C7C7" }}
              title={status === "live" ? "Live" : status === "loading" ? "Loading" : "Last known value"}
            />
          </div>
          <div className="text-[13px] font-semibold mt-0.5" style={{ color: T.ink }}>
            {nifty.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
            <span className="text-[11px] font-medium" style={{ color: niftyUp ? T.green : T.red }}>
              {niftyUp ? "+" : ""}
              {nifty.change.toFixed(2)} ({nifty.pct.toFixed(2)}%)
            </span>
          </div>
        </div>
        <div className="flex-1 px-4 py-2.5 flex items-start justify-between">
          <div>
            <div className="text-[10px] font-medium tracking-wide" style={{ color: T.sub }}>
              BANKNIFTY
            </div>
            <div className="text-[13px] font-semibold mt-0.5" style={{ color: T.ink }}>
              {bankNifty.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
              <span className="text-[11px] font-medium" style={{ color: bankUp ? T.green : T.red }}>
                {bankUp ? "+" : ""}
                {bankNifty.change.toFixed(2)} ({bankNifty.pct.toFixed(2)}%)
              </span>
            </div>
          </div>
          <ChevronDown size={15} style={{ color: T.sub, marginTop: 2 }} />
        </div>
      </div>

      {status === "fallback" && (
        <div className="px-4 py-1.5 text-[10px] text-center" style={{ background: "#FFF7E6", color: "#9A6B00" }}>
          Showing last known values — live feed unavailable right now
        </div>
      )}

      <div className="flex items-center gap-5 px-4 pt-3">
        <button onClick={onMenuClick}>
          <Menu size={18} style={{ color: T.ink }} />
        </button>
        <div className="flex items-center gap-1 pb-2 border-b-2" style={{ borderColor: T.accent }}>
          <span className="text-[13px] font-semibold" style={{ color: T.accent }}>
            My list 1
          </span>
          <ChevronDown size={14} style={{ color: T.accent }} />
        </div>
        <span className="text-[13px] pb-2" style={{ color: "#B3B3B3" }}>
          Predefined
        </span>
        <span className="text-[13px] pb-2 whitespace-nowrap" style={{ color: "#B3B3B3" }}>
          Option Chain
        </span>
      </div>
      <div className="h-px" style={{ background: T.line }} />

      <div className="flex items-center gap-2.5 px-4 py-3">
        <div className="flex-1 flex items-center gap-2 rounded-full px-3.5 py-2.5 border" style={{ borderColor: "#D8D8D8" }}>
          <Search size={15} style={{ color: T.sub }} />
          <span className="text-[13px]" style={{ color: T.sub }}>
            Search for{" "}
            <span className="font-semibold" style={{ color: T.ink }}>
              {typed}
              <span className="inline-block w-[1px] h-[13px] align-middle ml-0.5 animate-pulse" style={{ background: T.ink }} />
            </span>
          </span>
        </div>
        <SlidersHorizontal size={19} style={{ color: T.ink }} />
        <Settings size={19} style={{ color: T.ink }} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-10 -mt-6">
        <div className="w-24 h-24 rounded-full flex items-center justify-center mb-2" style={{ background: "#F4F2FA" }}>
          <FolderOpen size={40} strokeWidth={1.4} style={{ color: "#C7BFE0" }} />
        </div>
        <p className="text-center text-[14px] font-medium mt-3" style={{ color: T.ink }}>
          Keep tabs on your favourite investments?
        </p>
        <p className="text-center text-[12.5px] mt-1 leading-snug" style={{ color: T.sub }}>
          Start tracking your preferred <span className="font-semibold" style={{ color: T.ink }}>Stocks</span>,{" "}
          <span className="font-semibold" style={{ color: T.ink }}>ETFs</span>,{" "}
          <span className="font-semibold" style={{ color: T.ink }}>Mutual Funds</span>, and{" "}
          <span className="font-semibold" style={{ color: T.ink }}>Indices</span> all in one place.
        </p>
        <button className="mt-5 px-6 py-2 rounded-lg text-[13px] font-semibold border-2" style={{ borderColor: T.accent, color: T.accent }}>
          Add Now
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   SCREEN — Menu (profile card, plan, funds, quick links grid)
   Placeholder identity + client ID, not the real account
   details from the reference screenshot.
--------------------------------------------------------- */
function MenuScreen({ onBack, onOpenProfile }) {
  const [tab, setTab] = useState("QUICK LINKS");
  const tabs = ["QUICK LINKS", "PRODUCTS", "OFFERINGS", "REPORTS"];
  const links = [
    { label: "Option arena", icon: ListChecks },
    { label: "Insta Charts", icon: BarChart3 },
    { label: "Demat Balance", icon: Wallet },
    { label: "Initial Public\nOfferings", icon: Flag },
    { label: "Booked P&L\nreport", icon: FileBarChart },
    { label: "Ledger", icon: BookText },
    { label: "Mutual Funds", icon: PiggyBank },
    { label: "Exchange traded\nfunds", icon: Repeat },
    { label: "Ideas", icon: Lightbulb },
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: T.bg }}>
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack}>
            <ArrowLeft size={20} style={{ color: T.ink }} />
          </button>
          <span className="text-[17px] font-bold" style={{ color: T.ink }}>
            Menu
          </span>
        </div>
        <div className="flex items-center gap-4">
          <MessageSquare size={19} style={{ color: T.ink }} />
          <Settings size={19} style={{ color: T.ink }} />
          <Bell size={19} style={{ color: T.ink }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Profile card */}
        <div className="mx-4 rounded-lg border" style={{ borderColor: T.line }}>
          <button onClick={onOpenProfile} className="flex items-center gap-3 px-4 py-3.5 w-full text-left">
            <div className="relative shrink-0">
              <div
                className="w-11 h-11 rounded-md flex items-center justify-center border font-bold text-[14px]"
                style={{ borderColor: T.line, color: T.ink }}
              >
                S
              </div>
              <div
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: T.accent }}
              >
                <Camera size={10} color="#fff" />
              </div>
            </div>
            <div>
              <div className="text-[15px] font-bold" style={{ color: T.ink }}>
                SHRIKANT SHRINIWAS BHISE
              </div>
              <div className="text-[11.5px]" style={{ color: T.sub }}>
                Client ID: 4002390722
              </div>
            </div>
          </button>
          <div className="h-px" style={{ background: T.line }} />
          <div className="flex items-center justify-between px-4 py-3" style={{ background: "#F2EFFA" }}>
            <div>
              <div className="text-[10.5px]" style={{ color: T.sub }}>
                Current plan
              </div>
              <div className="text-[13px] font-semibold mt-0.5" style={{ color: T.ink }}>
                AOS30DIGIFREE
              </div>
            </div>
            <span
              onClick={onOpenProfile}
              className="text-[12px] font-semibold underline cursor-pointer"
              style={{ color: T.accent }}
            >
              View details
            </span>
          </div>
        </div>

        {/* Available funds */}
        <div className="px-4 py-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11.5px]" style={{ color: T.sub }}>
                Available Funds
              </div>
              <div className="text-[19px] font-bold mt-0.5" style={{ color: T.ink }}>
                ₹0.00
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="px-3 py-1.5 rounded-full text-[11px] font-semibold border-2"
                style={{ borderColor: T.accent, color: T.accent }}
              >
                Hold/Transfer
              </button>
              <button
                className="px-3 py-1.5 rounded-full text-[11px] font-semibold border-2"
                style={{ borderColor: T.accent, color: T.accent }}
              >
                Release/Withdraw
              </button>
            </div>
          </div>
          <div className="flex items-center gap-6 mt-3">
            <span className="text-[12px] font-semibold underline" style={{ color: T.accent }}>
              View Limits
            </span>
            <span className="text-[12px] font-semibold underline" style={{ color: T.accent }}>
              Pledge
            </span>
            <span className="text-[12px] font-semibold underline" style={{ color: T.accent }}>
              UnPledge
            </span>
          </div>
        </div>

        <div className="h-2" style={{ background: T.panel }} />

        {/* Quick links tab strip */}
        <div className="px-4 pt-3">
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: T.line }}>
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 py-2.5 text-[10.5px] font-semibold"
                style={{
                  background: t === tab ? T.accent : "#fff",
                  color: t === tab ? "#fff" : "#B3B3B3",
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-3 gap-y-6 px-6 py-6">
          {links.map(({ label, icon: Icon }) => (
            <div key={label} className="flex flex-col items-center gap-2 text-center">
              <div className="w-14 h-14 rounded-lg flex items-center justify-center" style={{ background: T.panel }}>
                <Icon size={22} strokeWidth={1.6} style={{ color: T.accent }} />
              </div>
              <span className="text-[11.5px] leading-tight whitespace-pre-line" style={{ color: T.ink }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   SCREEN — Profile > Account Details
   Entirely fictional demat/bank/plan data — not the real
   account numbers or broker/bank names from the reference.
--------------------------------------------------------- */
function ProfileScreen({ onBack }) {
  const [tab, setTab] = useState("Account Details");
  const tabs = ["Basic Details", "Account Details", "Consent Mgmt"];
  const { netWorth } = useDailyPortfolio();

  return (
    <div className="flex flex-col h-full" style={{ background: T.bg }}>
      <div className="flex items-center gap-3 px-4 py-4 shrink-0" style={{ background: T.panel }}>
        <button onClick={onBack}>
          <ArrowLeft size={20} style={{ color: T.accent }} />
        </button>
        <span className="text-[19px] font-bold" style={{ color: T.ink }}>
          Profile
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center gap-3 px-4 py-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "#E4E1F0" }}
          >
            <User size={26} style={{ color: "#8A80B0" }} strokeWidth={1.6} />
          </div>
          <div>
            <div className="text-[16px] font-bold" style={{ color: T.ink }}>
              SHRIKANT SHRINIWAS BHISE
            </div>
            <div className="text-[12px]" style={{ color: T.sub }}>
              4002390722
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 px-4 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="text-[13px] pb-2 whitespace-nowrap"
              style={{
                color: t === tab ? T.accent : "#9A9A9A",
                fontWeight: t === tab ? 700 : 500,
                borderBottom: t === tab ? `2px solid ${T.accent}` : "2px solid transparent",
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="h-px" style={{ background: T.line }} />

        {tab === "Basic Details" && (
          <>
            <div className="px-4 pt-4">
              <div
                className="rounded-xl p-5 relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${T.accent} 0%, #6552AE 100%)` }}
              >
                <div
                  className="absolute -right-6 -top-8 w-28 h-28 rounded-full"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                />
                <div className="relative">
                  <div className="text-[12.5px]" style={{ color: "#E1DAF3" }}>
                    My Networth
                  </div>
                  <div className="text-[24px] font-bold text-white mt-1">{inr(netWorth)}</div>
                  <div className="text-[11.5px] mt-1" style={{ color: "#E1DAF3" }}>
                    Bank Balance + Portfolio Value
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-4">
                <button
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold text-white"
                  style={{ background: T.accent }}
                >
                  <Pencil size={14} />
                  Edit Profile
                </button>
              </div>
            </div>

            <div className="mt-2">
              {[
                ["Email Address", "SHREEKANTBHISE31@GMAIL.COM"],
                ["Mobile Number", "9922926631"],
                ["Preferred Mode of\nCommunication", "Email, Phone"],
                ["PAN Number", "AGFP****6M"],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="flex items-start justify-between px-4 py-3.5 gap-4">
                    <span className="text-[13px] whitespace-pre-line" style={{ color: T.ink }}>
                      {label}
                    </span>
                    <span className="text-[13px] font-medium text-right" style={{ color: T.sub }}>
                      {value}
                    </span>
                  </div>
                  <div className="h-px" style={{ background: T.line }} />
                </div>
              ))}
              <div className="px-4 py-3.5">
                <span className="text-[13px]" style={{ color: T.ink }}>
                  Contact Address
                </span>
                <p className="text-[12.5px] mt-1.5 leading-snug" style={{ color: T.sub }}>
                  C O SHRIKANT BHISE FLAT NO 08 PHOENEX
                  APARTMENT,SENAPATI BAPAT ROAD NEAR
                  VETALBABA CHOWK, PUNE, MAHARASHTRA, INDIA
                 
                </p>
              </div>
            </div>
          </>
        )}

        {tab === "Consent Mgmt" && (
          <div className="px-4 py-10 text-center text-[13px]" style={{ color: T.sub }}>
            Demo screen — no consent management content in this prototype.
          </div>
        )}

        {tab === "Account Details" && (
          <>
            <div className="h-2.5" style={{ background: T.panel }} />
            <div className="px-4 py-4">
              <div className="text-[12.5px] font-medium" style={{ color: T.sub }}>
                Demat Details
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-[14px] font-bold" style={{ color: T.ink }}>
                  SBI SECURITIES LTD
                </span>
                <span className="text-[11px]" style={{ color: T.sub }}>
                  Default
                </span>
              </div>
              {[
                ["Depository Name", "CDSL"],
                ["Depository ID", "12047200"],
                ["Depository Account Number", "1204720055092085"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between mt-2.5">
                  <span className="text-[12.5px]" style={{ color: T.sub }}>
                    {label}
                  </span>
                  <span className="text-[13px] font-mono font-medium" style={{ color: T.ink }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>

            <div className="h-2.5" style={{ background: T.panel }} />
            <div className="px-4 py-4">
              <div className="text-[12.5px] font-medium" style={{ color: T.sub }}>
                Bank Details
              </div>

              <div className="flex items-center justify-between mt-3">
                <span className="text-[14px] font-bold" style={{ color: T.ink }}>
                  IDBI BANK
                </span>
                <span className="text-[11px]" style={{ color: T.sub }}>
                  Default
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[12.5px]" style={{ color: T.sub }}>
                  Account Number
                </span>
                <span className="text-[13px] font-mono font-medium" style={{ color: T.ink }}>
                  60010010006253
                </span>
              </div>

              <div className="h-px my-3" style={{ background: T.line }} />

              <div className="flex items-center justify-between">
                <span className="text-[14px] font-bold" style={{ color: T.ink }}>
                  STATE BANK OF INDIA
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[12.5px]" style={{ color: T.sub }}>
                  Account Number
                </span>
                <span className="text-[13px] font-mono font-medium" style={{ color: T.ink }}>
                  64007161953
                </span>
              </div>
            </div>

            <div className="h-2.5" style={{ background: T.panel }} />
            <div className="px-4 py-4 pb-8">
              <div className="text-[12.5px] font-medium" style={{ color: T.sub }}>
                Plan Details
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-[14px] font-bold" style={{ color: T.ink }}>
                  AOS30DIGIFREE
                </span>
                <span
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-semibold border-2"
                  style={{ borderColor: T.accent, color: T.accent }}
                >
                  <CheckCircle2 size={13} style={{ color: T.accent }} />
                  Selected Plan
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   APP SHELL — mpin -> watchlist / portfolio via bottom nav
--------------------------------------------------------- */
export default function LoginWatchlistDemo() {
  const [screen, setScreen] = useState("mpin"); // mpin | watchlist | portfolio | menu | profile
  const [returnTo, setReturnTo] = useState("watchlist");

  const openMenu = () => {
    setReturnTo(screen);
    setScreen("menu");
  };

  const navItems = [
    { id: "explore", label: "Explore", icon: LayoutGrid },
    { id: "watchlist", label: "Watchlist", icon: Bookmark },
    { id: "portfolio", label: "Portfolio", icon: Briefcase },
    { id: "orders", label: "Orders", icon: BookText },
    { id: "invest", label: "Invest", icon: IndianRupee },
  ];

  return (
    <div className="w-full flex flex-col" style={{ background: T.bg, height: "100dvh" }}>
      <div className="flex-1 overflow-hidden flex flex-col">
        {screen === "mpin" && <MpinScreen onUnlock={() => setScreen("watchlist")} />}
        {screen === "watchlist" && <WatchlistScreen onMenuClick={openMenu} />}
        {screen === "portfolio" && <PortfolioScreen onMenuClick={openMenu} />}
        {screen === "menu" && (
          <MenuScreen onBack={() => setScreen(returnTo)} onOpenProfile={() => setScreen("profile")} />
        )}
        {screen === "profile" && <ProfileScreen onBack={() => setScreen("menu")} />}
      </div>

      {screen !== "mpin" && screen !== "menu" && screen !== "profile" && (
        <div className="shrink-0 flex border-t" style={{ borderColor: T.line, background: T.bg }}>
          {navItems.map(({ id, label, icon: Icon }) => {
            const active = id === screen;
            return (
              <button
                key={id}
                onClick={() => (id === "watchlist" || id === "portfolio") && setScreen(id)}
                className="flex-1 flex flex-col items-center gap-1 py-2.5"
              >
                <Icon size={18} color={active ? T.accent : "#8A8A8A"} strokeWidth={active ? 2.3 : 1.8} />
                <span className="text-[10px] font-medium" style={{ color: active ? T.accent : "#8A8A8A" }}>
                  {label}
                </span>
              </button>
              );
            })}
          </div>
        )}
      </div>
  );
}