const { useState, useRef, useEffect, useMemo } = React;

// ─── Data ────────────────────────────────────────────────────────────────────

const UMH_GROUPS = [
{
  id: "brady", name: "Brady Bundle", advisor: "J. Brady", aum: 1934334,
  conflict: { severity: "warning", message: "Contains an account with an active trade restriction" },
  accounts: [
  { id: "brady-1", name: "Brady Joint Taxable", number: "314159", broker: "FirstClearing", value: 1100000 },
  { id: "brady-2", name: "Brady IRA", number: "314160", broker: "FirstClearing", value: 834334,
    conflict: { severity: "error", message: "Account is closed — cannot transact" } }]

},
{
  id: "fraser", name: "Fraser Household", advisor: "M. Fraser", aum: 2418000,
  accounts: [
  { id: "fraser-1", name: "Fraser Taxable", number: "556001", broker: "Fidelity", value: 1418000 },
  { id: "fraser-2", name: "Fraser Roth IRA", number: "556002", broker: "Fidelity", value: 1000000 }]

},
{
  id: "garcia", name: "Garcia Growth Strategy", advisor: "T. Rivera", aum: 2598947,
  accounts: [
  { id: "garcia-1", name: "Core Equity", number: "5025", broker: "FirstClearing", value: 801320 },
  { id: "garcia-2", name: "Dynamic Allocation 2", number: "8678", broker: "FirstClearing", value: 1797627,
    conflict: { severity: "warning", message: "Pending orders — may be affected" } }]

}];


const SOLO_ACCOUNTS = [
{ id: "smith", name: "Smith IRA", number: "443201", broker: "Fidelity", value: 340000,
  conflict: { severity: "error", message: "Account is closed — cannot transact" } },
{ id: "johnson", name: "Johnson Taxable", number: "887102", broker: "FirstClearing", value: 215000,
  conflict: { severity: "warning", message: "Custodian connection last synced 4 days ago" } },
{ id: "karen", name: "Karen Thompson Revocable Trust", number: "4858", broker: "Fidelity", value: 56751,
  conflict: { severity: "error", message: "Compliance hold — selection blocked" } }];


function fmt(n) {return "$" + n.toLocaleString();}

// Conflict severity → palette + icon. Warning uses the existing amber treatment;
// error uses the design-system red (--smx-color-error #BA1A1A).
const SEVERITY_THEME = {
  warning: { bg: "#FFE0C2", fg: "#6B3400", icon: "warning", label: "Warning" },
  error: { bg: "#FCD8D8", fg: "#7A0F0F", icon: "error", label: "Error" }
};

// Normalize a conflict (string | {severity,message} | undefined) to a uniform shape.
function normConflict(c) {
  if (!c) return null;
  if (typeof c === "string") return { severity: "warning", message: c };
  return { severity: c.severity || "warning", message: c.message };
}

// Roll up an item's own conflict + any child conflicts into the most severe seen.
function rollupConflict(item) {
  const own = normConflict(item.conflict);
  const childConflicts = (item.accounts || []).map((a) => normConflict(a.conflict)).filter(Boolean);
  const all = [own, ...childConflicts].filter(Boolean);
  if (!all.length) return null;
  const hasError = all.some((c) => c.severity === "error");
  // Prefer the item's own message if present; otherwise summarize children.
  if (own) return hasError && own.severity !== "error" ?
  { severity: "error", message: own.message + " (and a contained account is blocked)" } :
  own;
  const errs = childConflicts.filter((c) => c.severity === "error");
  if (errs.length) return { severity: "error", message: `${errs.length} contained account${errs.length > 1 ? "s are" : " is"} blocked` };
  return { severity: "warning", message: `${childConflicts.length} contained account${childConflicts.length > 1 ? "s have" : " has"} a warning` };
}

// Inline strip used inside dropdown rows + the summary panel.
function ConflictBanner({ conflict, indent = 46 }) {
  if (!conflict) return null;
  const t = SEVERITY_THEME[conflict.severity] || SEVERITY_THEME.warning;
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 8,
      padding: `8px 16px 8px ${indent}px`,
      background: t.bg, color: t.fg,
      fontSize: 12, fontFamily: "var(--smx-font-family)", letterSpacing: "0.033em"
    }}>
      <MSIcon name={t.icon} size={16} color={t.fg} style={{ marginTop: 1 }} />
      <span style={{ lineHeight: 1.5 }}>{conflict.message}</span>
    </div>);

}

// Highlight matching substring inside text. Renders text spans + a teal-tinted
// <mark>-style span on the matched range. Case-insensitive.
function Highlight({ text, query }) {
  const t = String(text);
  const q = (query || "").trim();
  if (!q) return <>{t}</>;
  const i = t.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return <>{t}</>;
  return (
    <>
      {t.slice(0, i)}
      <span style={{
        background: "#FFE0C2",
        color: "inherit",
        padding: "0 2px",
        borderRadius: 2
      }}>{t.slice(i, i + q.length)}</span>
      {t.slice(i + q.length)}
    </>);

}

// ─── Base SmartX/Material primitives ──────────────────────────────────────────

const MSIcon = ({ name, size = 20, color, style = {} }) =>
<span
  className="material-symbols-outlined"
  style={{
    fontFamily: "Material Symbols Outlined",
    fontSize: size,
    color: color || "inherit",
    lineHeight: 1,
    userSelect: "none",
    fontVariationSettings: '"FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24',
    flexShrink: 0,
    ...style
  }}>
  {name}</span>;


// Material checkbox (teal filled when checked, outlined when not)
function MdCheckbox({ checked, indeterminate, disabled }) {
  const active = checked || indeterminate;
  return (
    <span style={{
      width: 18, height: 18, borderRadius: 2, flexShrink: 0,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      border: active ? "none" : `2px solid ${disabled ? "rgba(0,0,0,.26)" : "rgba(0,0,0,.54)"}`,
      background: active ? disabled ? "rgba(0,0,0,.26)" : "var(--smx-color-primary)" : "transparent",
      transition: "background 150ms, border-color 150ms"
    }}>
      {checked && <MSIcon name="check" size={16} color="#fff" />}
      {indeterminate && !checked && <MSIcon name="remove" size={16} color="#fff" />}
    </span>);

}

// Material switch
function MdSwitch({ value, onChange }) {
  return (
    <button
      role="switch" aria-checked={value}
      onClick={() => onChange(!value)}
      style={{
        width: 36, height: 20, borderRadius: 999, border: "none", cursor: "pointer",
        background: value ? "var(--smx-color-track-active)" : "var(--smx-color-track-default)",
        position: "relative", transition: "background 200ms", flexShrink: 0, padding: 0
      }}>
      
      <span style={{
        position: "absolute", top: 1, left: value ? 17 : 1,
        width: 18, height: 18, borderRadius: "50%",
        background: value ? "var(--smx-color-primary)" : "#fafafa",
        boxShadow: "0 1px 3px rgba(0,0,0,.24), 0 1px 1px rgba(0,0,0,.14)",
        transition: "left 180ms cubic-bezier(0.4,0,0.2,1), background 180ms"
      }} />
    </button>);

}

// Section header — solid grey fill (matches existing custom select)
function Overline({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 500, color: "rgba(0,0,0,0.6)",
      letterSpacing: "0.1em", textTransform: "uppercase",
      padding: "8px 16px",
      background: "var(--smx-color-neutral)",
      fontFamily: "var(--smx-font-family)",
      borderTop: "1px solid var(--smx-color-divider)",
      borderBottom: "1px solid var(--smx-color-divider)"
    }}>
      {children}
    </div>);

}

// ─── Dropdown (MdMenu-flavored list) ──────────────────────────────────────────

function DropdownList({ query, selected, onSelectWhole, onSelectAccount, onDeselect, config }) {
  const { multiSelect, allowIndividualAccounts, showWarnings } = config;

  const isSelected = (id) => selected.some((s) => s.id === id);
  // In single-select, picking a different row REPLACES the current selection —
  // no row is disabled. Selected row still toggles off if clicked again.
  const isDisabled = () => false;

  const q = query.trim().toLowerCase();
  const hasQuery = q.length > 0;

  // ─── Search across accounts INSIDE umh groups too ───
  // For each UMH group: include if name matches OR any nested account matches
  // Track which child accounts matched so we can highlight them in the expanded list.
  const filteredUMH = UMH_GROUPS.
  map((u) => {
    const groupHit = !hasQuery || u.name.toLowerCase().includes(q);
    const matchedAccountIds = new Set(
      u.accounts.
      filter((a) => a.name.toLowerCase().includes(q) || a.number.includes(query.trim())).
      map((a) => a.id)
    );
    const include = !hasQuery || groupHit || matchedAccountIds.size > 0;
    return include ? { ...u, _groupHit: groupHit, _matchedAccountIds: matchedAccountIds } : null;
  }).
  filter(Boolean);

  const filteredSolo = SOLO_ACCOUNTS.filter((a) =>
  !hasQuery ||
  a.name.toLowerCase().includes(q) ||
  a.number.includes(query.trim())
  );

  // Auto-expand any UMH whose search hit was on a nested account (not the group name).
  // Also default-expand all groups when searching, so users see the matching account.
  const [manualExpanded, setManualExpanded] = useState(new Set());
  const expandedUMHs = useMemo(() => {
    const auto = new Set(manualExpanded);
    if (hasQuery) {
      filteredUMH.forEach((u) => {
        if (u._matchedAccountIds.size > 0) auto.add(u.id);
      });
    }
    return auto;
  }, [manualExpanded, hasQuery, filteredUMH.map((u) => u.id + ":" + u._matchedAccountIds.size).join("|")]);

  const toggleExpand = (id, e) => {
    e.stopPropagation();
    setManualExpanded((prev) => {const n = new Set(prev);n.has(id) ? n.delete(id) : n.add(id);return n;});
  };

  if (!filteredUMH.length && !filteredSolo.length) {
    return (
      <div style={{ padding: "24px 16px", textAlign: "center", fontSize: 14,
        fontFamily: "var(--smx-font-family)", color: "var(--smx-color-medium-emphasis)" }}>
        No results
      </div>);

  }

  const rowBase = (sel, disabled, blocked) => ({
    display: "flex", alignItems: "center", padding: "10px 16px", gap: 12,
    cursor: disabled ? "not-allowed" : "pointer",
    background: sel ? "var(--smx-color-neutral-variant)" : "transparent",
    opacity: blocked ? 0.6 : disabled ? 0.38 : 1,
    transition: "background 150ms var(--ease-table)",
    fontFamily: "var(--smx-font-family)"
  });

  return (
    <div>
      {filteredUMH.length > 0 &&
      <>
          <Overline>UMH groups</Overline>
          {filteredUMH.map((u) => {
          const sel = isSelected(u.id);
          const expanded = expandedUMHs.has(u.id);
          const uConflict = showWarnings ? rollupConflict(u) : null;
          const blocked = uConflict?.severity === "error";
          const disabled = isDisabled(u.id) || blocked;
          return (
            <div key={u.id}>
                <div
                style={rowBase(sel, disabled, blocked)}
                onClick={() => {if (disabled) return;sel ? onDeselect(u.id) : onSelectWhole({ ...u, kind: "umh" });}}
                onMouseEnter={(e) => {if (!sel && !disabled) e.currentTarget.style.background = "#F3F8F7";}}
                onMouseLeave={(e) => {e.currentTarget.style.background = sel ? "var(--smx-color-neutral-variant)" : "transparent";}}>
                
                  {multiSelect && <MdCheckbox checked={sel} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "var(--smx-color-high-emphasis)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><Highlight text={u.name} query={query} /></span>
                    </div>
                    <span style={{ fontSize: 12, color: "var(--smx-color-medium-emphasis)", letterSpacing: "0.033em" }}>
                      {u.accounts.length} accounts
                    </span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--smx-color-high-emphasis)",
                  fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{fmt(u.aum)}</span>
                  <span
                  onClick={(e) => toggleExpand(u.id, e)}
                  style={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", transition: "background 150ms"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,.04)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  
                    <MSIcon
                    name="expand_more"
                    size={20}
                    color="var(--smx-color-medium-emphasis)"
                    style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 200ms var(--ease-standard)" }} />
                  
                  </span>
                </div>

                {uConflict && (sel || blocked) &&
              <ConflictBanner conflict={uConflict} indent={46} />
              }

                {expanded &&
              <div style={{ background: "#fff" }}>
                    {u.accounts.map((acc) => {
                  const accSel = isSelected(acc.id);
                  const accConflict = showWarnings ? normConflict(acc.conflict) : null;
                  const accBlocked = accConflict?.severity === "error";
                  const canPick = allowIndividualAccounts && !sel && !accBlocked;
                  const isMatch = hasQuery && u._matchedAccountIds.has(acc.id);
                  return (
                    <div key={acc.id}>
                          <div
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: canPick && multiSelect ? "8px 16px 8px 40px" : "8px 16px 8px 46px",
                          cursor: canPick ? "pointer" : accBlocked ? "not-allowed" : "default",
                          opacity: accBlocked ? 0.55 : 1,
                          background: accSel ?
                          "var(--smx-color-neutral-variant)" :
                          isMatch ? "rgba(0,107,91,0.06)" : "transparent",
                          fontFamily: "var(--smx-font-family)",
                          transition: "background 150ms"
                        }}
                        onClick={canPick ? (e) => {e.stopPropagation();accSel ? onDeselect(acc.id) : onSelectAccount({ ...acc, kind: "account", parentId: u.id, parentName: u.name });} : undefined}
                        onMouseEnter={(e) => {if (canPick && !accSel) e.currentTarget.style.background = "#F3F8F7";}}
                        onMouseLeave={(e) => {e.currentTarget.style.background = accSel ?
                          "var(--smx-color-neutral-variant)" :
                          isMatch ? "rgba(0,107,91,0.06)" : "transparent";}}>
                        
                            {canPick && multiSelect ?
                        <MdCheckbox checked={accSel} /> :
                        null
                        }
                            <div style={{ flex: 1, minWidth: 0, paddingLeft: canPick && multiSelect ? 0 : 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 13, color: "var(--smx-color-high-emphasis)" }}><Highlight text={acc.name} query={query} /></span>
                              </div>
                              <span style={{ fontSize: 11, color: "var(--smx-color-medium-emphasis)",
                            fontFamily: "var(--smx-font-family)", letterSpacing: "0.033em" }}>
                                ····<Highlight text={acc.number} query={query} />
                              </span>
                            </div>
                            <span style={{ fontSize: 12, color: "var(--smx-color-high-emphasis)",
                          fontVariantNumeric: "tabular-nums" }}>{fmt(acc.value)}</span>
                          </div>
                          {accConflict && (accSel || accBlocked) &&
                      <ConflictBanner conflict={accConflict} indent={50} />
                      }
                        </div>);

                })}
                    {!allowIndividualAccounts &&
                <div style={{ padding: "6px 16px 10px 40px",
                  fontSize: 11, color: "var(--smx-color-disabled)",
                  fontFamily: "var(--smx-font-family)", fontStyle: "italic" }}>
                        Selecting this group includes all accounts
                      </div>
                }
                  </div>
              }
              </div>);

        })}
        </>
      }

      {filteredSolo.length > 0 &&
      <>
          <Overline>Individual accounts</Overline>
          {filteredSolo.map((a) => {
          const sel = isSelected(a.id);
          const aConflict = showWarnings ? normConflict(a.conflict) : null;
          const blocked = aConflict?.severity === "error";
          const disabled = isDisabled(a.id) || blocked;
          return (
            <div key={a.id}>
                <div
                style={rowBase(sel, disabled, blocked)}
                onClick={() => {if (disabled) return;sel ? onDeselect(a.id) : onSelectWhole({ ...a, kind: "solo" });}}
                onMouseEnter={(e) => {if (!sel && !disabled) e.currentTarget.style.background = "#F3F8F7";}}
                onMouseLeave={(e) => {e.currentTarget.style.background = sel ? "var(--smx-color-neutral-variant)" : "transparent";}}>
                
                  {multiSelect && <MdCheckbox checked={sel} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "var(--smx-color-high-emphasis)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><Highlight text={a.name} query={query} /></span>
                    </div>
                    <span style={{ fontSize: 12, color: "var(--smx-color-medium-emphasis)",
                    fontFamily: "var(--smx-font-family)", letterSpacing: "0.033em" }}>
                      ····<Highlight text={a.number} query={query} />
                    </span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--smx-color-high-emphasis)",
                  fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{fmt(a.value)}</span>
                </div>
                {aConflict && (sel || blocked) &&
              <ConflictBanner conflict={aConflict} indent={46} />
              }
              </div>);

        })}
        </>
      }
    </div>);

}

// ─── Selection summary panel (MdCard outlined) ────────────────────────────────

function SelectionSummary({ selected, onRemove, showWarnings }) {
  const [open, setOpen] = useState(true);
  const [expandedItems, setExpanded] = useState(new Set());
  const toggleExpand = (id) => setExpanded((prev) => {const n = new Set(prev);n.has(id) ? n.delete(id) : n.add(id);return n;});

  const umhs = selected.filter((s) => s.kind === "umh");
  const solos = selected.filter((s) => s.kind === "solo");
  const loose = selected.filter((s) => s.kind === "account");
  const totalAUM = selected.reduce((s, i) => s + (i.aum || i.value || 0), 0);
  const anyConflict = showWarnings ?
  selected.map((s) => rollupConflict(s)).filter(Boolean) :
  [];
  const summarySeverity = anyConflict.some((c) => c.severity === "error") ? "error" :
  anyConflict.length ? "warning" :
  null;
  const parentIds = new Set(umhs.map((u) => u.id));

  const byParent = {};
  loose.filter((a) => !parentIds.has(a.parentId)).forEach((a) => {
    if (!byParent[a.parentId]) byParent[a.parentId] = { name: a.parentName, accounts: [] };
    byParent[a.parentId].accounts.push(a);
  });

  const removeBtn = (id) =>
  <button
    onClick={() => onRemove(id)}
    title="Remove"
    style={{
      width: 32, height: 32, border: "none", borderRadius: "50%", cursor: "pointer",
      background: "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center",
      color: "var(--smx-color-medium-emphasis)", flexShrink: 0,
      transition: "background 150ms"
    }}
    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,.04)"}
    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
    
      <MSIcon name="close" size={18} />
    </button>;


  return (
    <div style={{
      marginTop: 12,
      background: "#fff",
      border: "1px solid var(--smx-color-divider)",
      borderRadius: 4,
      fontFamily: "var(--smx-font-family)",
      overflow: "hidden"
    }}>
      {/* Summary header */}
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 16px", background: "var(--smx-color-neutral-variant)",
          cursor: "pointer", gap: 12, borderBottom: open ? "1px solid var(--smx-color-divider)" : "none"
        }}>
        
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--smx-color-primary)" }}>
            {selected.length} selected
          </span>
          <span style={{ width: 1, height: 14, background: "rgba(0,0,0,.2)" }} />
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--smx-color-high-emphasis)",
            fontVariantNumeric: "tabular-nums" }}>
            {fmt(totalAUM)} <span style={{ color: "var(--smx-color-medium-emphasis)", fontWeight: 400 }}>AUM</span>
          </span>
          {summarySeverity && (() => {
            const t = SEVERITY_THEME[summarySeverity];
            return (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                height: 24, padding: "0 10px",
                background: t.bg, color: t.fg,
                borderRadius: 999, fontSize: 12, fontWeight: 500
              }}>
                <MSIcon name={t.icon} size={14} color={t.fg} />
                {t.label}
              </span>);

          })()}
        </div>
        <MSIcon
          name="expand_more"
          size={20}
          color="var(--smx-color-medium-emphasis)"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 200ms var(--ease-standard)" }} />
        
      </div>

      {open &&
      <div>
          {/* UMH items */}
          {umhs.map((item, i) => {
          const exp = expandedItems.has(item.id);
          const itemConflict = showWarnings ? rollupConflict(item) : null;
          return (
            <div key={item.id} style={{ borderTop: i === 0 ? "none" : "1px solid var(--smx-color-divider)" }}>
                <div style={{ display: "flex", alignItems: "center", padding: "10px 8px 10px 16px", gap: 10 }}>
                  <span
                  onClick={() => toggleExpand(item.id)}
                  style={{
                    width: 28, height: 28, borderRadius: "50%", cursor: "pointer", flexShrink: 0,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    transition: "background 150ms"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,.04)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  
                    <MSIcon
                    name="expand_more"
                    size={20}
                    color={exp ? "var(--smx-color-primary)" : "var(--smx-color-medium-emphasis)"}
                    style={{ transform: exp ? "rotate(180deg)" : "rotate(0)", transition: "transform 200ms var(--ease-standard)" }} />
                  
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--smx-color-high-emphasis)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: "var(--smx-color-medium-emphasis)" }}>
                      {item.accounts.length} accounts
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--smx-color-high-emphasis)",
                  fontVariantNumeric: "tabular-nums", flexShrink: 0, marginRight: 4 }}>{fmt(item.aum)}</span>
                  {removeBtn(item.id)}
                </div>

                {itemConflict &&
              <ConflictBanner conflict={itemConflict} indent={46} />
              }

                {exp &&
              <div style={{ background: "#fff" }}>
                    {item.accounts.map((acc, j) =>
                <div key={acc.id} style={{
                  display: "flex", alignItems: "center", padding: "8px 16px 8px 46px", gap: 10,
                  borderTop: j > 0 ? "1px solid var(--smx-color-divider)" : "none"
                }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: "var(--smx-color-high-emphasis)" }}>{acc.name}</div>
                          <div style={{ fontSize: 11, color: "var(--smx-color-medium-emphasis)", fontFamily: "Roboto" }}>
                            ····{acc.number}
                          </div>
                        </div>
                        <span style={{ fontSize: 12, color: "var(--smx-color-high-emphasis)",
                    fontVariantNumeric: "tabular-nums" }}>{fmt(acc.value)}</span>
                      </div>
                )}
                  </div>
              }
              </div>);

        })}

          {/* Loose accounts grouped by parent UMH */}
          {Object.entries(byParent).map(([parentId, { name, accounts }], gi) =>
        <div key={parentId} style={{ borderTop: gi === 0 && !umhs.length ? "none" : "1px solid var(--smx-color-divider)" }}>
              <div style={{
            padding: "8px 16px 4px",
            fontSize: 11, fontWeight: 500, color: "var(--smx-color-medium-emphasis)",
            textTransform: "uppercase", letterSpacing: "0.1em"
          }}>From {name}</div>
              {accounts.map((acc) =>
          <div key={acc.id}>
                  <div style={{ display: "flex", alignItems: "center", padding: "8px 8px 8px 16px", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--smx-color-high-emphasis)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{acc.name}</div>
                      <div style={{ fontSize: 12, color: "var(--smx-color-medium-emphasis)", fontFamily: "var(--smx-font-mono)" }}>
                        ····{acc.number}
                      </div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--smx-color-high-emphasis)",
                fontVariantNumeric: "tabular-nums", flexShrink: 0, marginRight: 4 }}>{fmt(acc.value)}</span>
                    {removeBtn(acc.id)}
                  </div>
                  {showWarnings && acc.conflict &&
            <ConflictBanner conflict={normConflict(acc.conflict)} indent={46} />
            }
                </div>
          )}
            </div>
        )}

          {/* Solo accounts */}
          {solos.map((item, i) => {
          const itemConflict = showWarnings ? normConflict(item.conflict) : null;
          const isFirst = i === 0 && !umhs.length && !Object.keys(byParent).length;
          return (
            <div key={item.id} style={{ borderTop: isFirst ? "none" : "1px solid var(--smx-color-divider)" }}>
                <div style={{ display: "flex", alignItems: "center", padding: "10px 8px 10px 16px", gap: 10 }}>
                  <span style={{ width: 28, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--smx-color-high-emphasis)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: "var(--smx-color-medium-emphasis)", fontFamily: "var(--smx-font-mono)" }}>
                      ····{item.number} · {item.broker}
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--smx-color-high-emphasis)",
                  fontVariantNumeric: "tabular-nums", flexShrink: 0, marginRight: 4 }}>{fmt(item.value)}</span>
                  {removeBtn(item.id)}
                </div>
                {itemConflict &&
              <ConflictBanner conflict={itemConflict} indent={46} />
              }
              </div>);

        })}
        </div>
      }
    </div>);

}

// ─── Account selector (MdTextfield outlined + menu) ───────────────────────────

function AccountSelector({ config }) {
  const { multiSelect } = config;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [selected, setSelected] = useState([]);
  const ref = useRef();
  const inputRef = useRef();

  useEffect(() => {setSelected([]);}, [multiSelect]);
  useEffect(() => {
    const h = (e) => {if (ref.current && !ref.current.contains(e.target)) setOpen(false);};
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const add = (item) => {
    setSelected((prev) => multiSelect ? [...prev, item] : [item]);
    setQuery("");
    if (!multiSelect) {
      setOpen(false);
    } else {
      // Keep input focused so the user can keep searching/picking without re-clicking.
      requestAnimationFrame(() => inputRef.current && inputRef.current.focus());
    }
  };
  const remove = (id) => setSelected((prev) => prev.filter((s) => s.id !== id));
  const clearSingle = () => {setSelected([]);setQuery("");requestAnimationFrame(() => inputRef.current && inputRef.current.focus());};

  // In single-select, when the dropdown is closed and we have a selection, show
  // it as a static value inside the field (matching the vue-mat-lib select).
  const singleSelected = !multiSelect && selected.length > 0 ? selected[0] : null;
  const showSingleValue = !!singleSelected && !open;

  const labelFloated = focused || query || open || showSingleValue;
  const borderColor = focused || open ? "var(--smx-color-primary)" : "rgba(0,0,0,.38)";

  return (
    <div>
      <div ref={ref} style={{ position: "relative" }}>
        {/* Outlined textfield anatomy */}
        <div
          onClick={() => {setOpen(true);requestAnimationFrame(() => inputRef.current && inputRef.current.focus());}}
          style={{
            position: "relative",
            border: `${focused || open ? 2 : 1}px solid ${borderColor}`,
            borderRadius: 4,
            height: 56,
            display: "flex", alignItems: "center",
            padding: focused || open ? "0 11px" : "0 12px",
            background: "#fff",
            cursor: "text",
            transition: "border-color 150ms"
          }}>
          
          <MSIcon name="search" size={20} color="var(--smx-color-medium-emphasis)" style={{ marginRight: 8 }} />
          <span style={{
            position: "absolute",
            background: "#fff",
            padding: "0 4px",
            left: labelFloated ? 36 : 40,
            top: labelFloated ? -8 : 18,
            fontSize: labelFloated ? 12 : 16,
            color: focused || open ? "var(--smx-color-primary)" : "var(--smx-color-medium-emphasis)",
            pointerEvents: "none",
            transition: "all 150ms cubic-bezier(0.4,0,0.2,1)",
            fontFamily: "var(--smx-font-family)",
            fontWeight: 400,
            letterSpacing: "0.009em"
          }}>
            Select portfolio
          </span>
          {showSingleValue ?
          <div style={{
            flex: 1, minWidth: 0,
            fontFamily: "var(--smx-font-family)", fontSize: 16,
            color: "var(--smx-color-high-emphasis)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
          }}>
              {singleSelected.name}
            </div> :

          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {setQuery(e.target.value);setOpen(true);}}
            onFocus={() => {setFocused(true);setOpen(true);}}
            onBlur={() => setFocused(false)}
            placeholder={labelFloated ? multiSelect ? "Search accounts or groups" : "Search one account or group" : ""}
            style={{
              flex: 1, border: "none", outline: "none", background: "transparent",
              fontFamily: "var(--smx-font-family)", fontSize: 16,
              color: "var(--smx-color-high-emphasis)",
              padding: 0, width: "100%"
            }} />

          }
          {!showSingleValue && query &&
          <span
            onClick={(e) => {e.stopPropagation();setQuery("");}}
            style={{
              width: 28, height: 28, borderRadius: "50%", cursor: "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: "var(--smx-color-medium-emphasis)",
              transition: "background 150ms"
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,.04)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            
              <MSIcon name="close" size={18} />
            </span>
          }
          <MSIcon
            name="expand_more"
            size={20}
            color="var(--smx-color-medium-emphasis)"
            style={{ marginLeft: 4, transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 200ms var(--ease-standard)" }} />
          
        </div>

        {/* MdMenu surface — elev-8, 4px radius */}
        {open &&
        <div
          onMouseDown={(e) => {
            // Prevent rows inside the dropdown from stealing focus from the input.
            // Without this, picking an item blurs the input and the user has to
            // click back into the field to keep typing.
            if (e.target !== inputRef.current) e.preventDefault();
          }}
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
            background: "#fff", zIndex: 30,
            borderRadius: 4,
            boxShadow: "var(--elev-8)",
            maxHeight: 340, overflowY: "auto",
            fontFamily: "var(--smx-font-family)"
          }}>
            <DropdownList
            query={query} selected={selected}
            onSelectWhole={add} onSelectAccount={add} onDeselect={remove}
            config={config} />
          
          </div>
        }
      </div>

      {multiSelect && selected.length > 0 &&
      <SelectionSummary selected={selected} onRemove={remove} showWarnings={config.showWarnings} />
      }
    </div>);

}

// ─── Config card ──────────────────────────────────────────────────────────────

function ConfigRow({ label, description, value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--smx-color-high-emphasis)",
          letterSpacing: "0.007em" }}>{label}</div>
        <div style={{ fontSize: 12, color: "var(--smx-color-medium-emphasis)", marginTop: 2,
          letterSpacing: "0.033em", lineHeight: 1.5 }}>{description}</div>
      </div>
      <MdSwitch value={value} onChange={onChange} />
    </div>);

}

// ─── Stepper (Material-ish) ───────────────────────────────────────────────────

function Stepper({ current = 0 }) {
  const steps = ["Account details", "Transaction details", "Preview"];
  return (
    <div style={{ display: "flex", alignItems: "center", marginTop: 16 }}>
      {steps.map((s, i) =>
      <React.Fragment key={s}>
          {i > 0 && <div style={{ flex: 1, height: 1, background: i <= current ? "var(--smx-color-primary)" : "var(--smx-color-divider)", margin: "0 8px" }} />}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
            width: 24, height: 24, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: i <= current ? "var(--smx-color-primary)" : "var(--smx-color-neutral)",
            color: i <= current ? "#fff" : "var(--smx-color-medium-emphasis)",
            fontSize: 13, fontWeight: 500
          }}>
              {i < current ? <MSIcon name="check" size={16} color="#fff" /> : i + 1}
            </div>
            <span style={{
            fontSize: 14, fontWeight: i === current ? 500 : 400,
            color: i === current ? "var(--smx-color-high-emphasis)" : "var(--smx-color-medium-emphasis)",
            letterSpacing: "0.007em"
          }}>{s}</span>
          </div>
        </React.Fragment>
      )}
    </div>);

}

// ─── Buttons ──────────────────────────────────────────────────────────────────

function MdBtn({ variant = "filled", children, onClick }) {
  const [hover, setHover] = useState(false);
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    border: "none", borderRadius: 4, gap: 8,
    fontFamily: "var(--smx-font-family)",
    fontSize: 14, fontWeight: 500, letterSpacing: "0.089em",
    textTransform: "capitalize", cursor: "pointer", userSelect: "none",
    minWidth: 80, height: 36, padding: "0 16px",
    transition: "background 150ms cubic-bezier(0.4,0,0.2,1), box-shadow 200ms"
  };
  if (variant === "filled") {
    return (
      <button onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onClick={onClick}
      style={{ ...base, background: hover ? "#005a4c" : "var(--smx-color-primary)", color: "#fff",
        boxShadow: "var(--elev-1)" }}>{children}</button>);

  }
  return (
    <button onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onClick={onClick}
    style={{ ...base, background: hover ? "rgba(0,107,91,.04)" : "transparent", color: "var(--smx-color-primary)" }}>{children}</button>);

}

// ─── Root ─────────────────────────────────────────────────────────────────────

function App() {
  const [multiSelect, setMultiSelect] = useState(true);
  const [allowIndividualAccounts, setAllowIndividualAccounts] = useState(false);
  const [showWarnings, setShowWarnings] = useState(true);
  const [inContext, setInContext] = useState(true);
  const config = { multiSelect, allowIndividualAccounts, showWarnings };

  return (
    <div className="smx-root" style={{
      fontFamily: "var(--smx-font-family)",
      background: "var(--smx-color-neutral)",
      minHeight: "100vh",
      display: "flex", justifyContent: "center",
      padding: "32px 24px 64px"
    }}>

      <div style={{
        width: "100%", maxWidth: 1080,
        display: "grid", gridTemplateColumns: "minmax(280px, 360px) 1fr",
        gap: 32, alignItems: "start"
      }}>

      {/* LEFT — heading + configuration */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 32 }}>
        <div>
          <div className="smx-type-overline" style={{ color: "var(--smx-color-primary)", marginBottom: 4 }}>
            SmartX · Rebalancer
          </div>
          <h1 style={{
            font: "500 24px/1.334 var(--smx-font-family)",
            color: "var(--smx-color-high-emphasis)",
            margin: 0, letterSpacing: "0.0125em"
          }}>Account selector demo</h1>
          <p style={{
            font: "400 14px/1.43 var(--smx-font-family)",
            color: "var(--smx-color-medium-emphasis)",
            margin: "8px 0 0", letterSpacing: "0.018em"
          }}>
            A working prototype of the new account selector for the Rebalancer.
            Toggle the configuration on the left to explore how the selector
            responds — variations are previewed live on the right.
          </p>
        </div>

        {/* Config — MdCard outlined */}
        <div style={{
          background: "#fff", borderRadius: 4,
          border: "1px solid var(--smx-color-divider)",
          padding: 16,
          display: "flex", flexDirection: "column", gap: 16
        }}>
          <div className="smx-type-overline" style={{ margin: 0, padding: 0, letterSpacing: "0.167em" }}>
            Configuration
          </div>
          <ConfigRow
            label="Multi-select"
            description={multiSelect ? "Users can pick multiple groups and accounts" : "Users can pick only one item"}
            value={multiSelect} onChange={setMultiSelect} />

          <div style={{ height: 1, background: "var(--smx-color-divider)" }} />
          <ConfigRow
            label="Individual account selection"
            description={allowIndividualAccounts ? "Users can pick individual accounts within a UMH group" : "Selecting a UMH selects all of its accounts"}
            value={allowIndividualAccounts} onChange={setAllowIndividualAccounts} />

          <div style={{ height: 1, background: "var(--smx-color-divider)" }} />
          <ConfigRow
            label="Conflict warnings & errors"
            description={showWarnings ? "Inline messages when a flagged item is selected" : "Hidden — try Brady Bundle, Smith IRA, or Karen Thompson Trust to compare"}
            value={showWarnings} onChange={setShowWarnings} />

          <div style={{ height: 1, background: "var(--smx-color-divider)" }} />
          <ConfigRow
            label="Show in surrounding flow"
            description={inContext ? "Previewed inside the Cash-management dialog (stepper, footer, etc.)" : "Just the selector and its selection table — no surrounding chrome"}
            value={inContext} onChange={setInContext} />
        </div>
      </div>

      {/* RIGHT — live demo */}
      <div>
        {inContext ? (
          // Dialog — MdCard elev-8
          <div style={{
            width: "100%", maxWidth: 520,
            background: "#fff", borderRadius: 4,
            boxShadow: "var(--elev-8)"
          }}>
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--smx-color-divider)" }}>
              <div style={{ font: "500 20px/1.6 var(--smx-font-family)",
                color: "var(--smx-color-high-emphasis)", letterSpacing: "0.0125em" }}>
                Create new deposit
              </div>
              <Stepper current={0} />
            </div>

            <div style={{ padding: "24px" }}>
              <AccountSelector key={`${multiSelect}-${allowIndividualAccounts}`} config={config} />

              <div style={{ marginTop: 24, opacity: 0.38, pointerEvents: "none" }}>
                <div style={{
                  position: "relative",
                  border: "1px solid rgba(0,0,0,.38)",
                  borderRadius: 4, height: 56,
                  display: "flex", alignItems: "center", padding: "0 12px"
                }}>
                  <span style={{
                    position: "absolute", background: "#fff", padding: "0 4px",
                    left: 8, top: -8, fontSize: 12,
                    color: "var(--smx-color-medium-emphasis)",
                    fontFamily: "var(--smx-font-family)"
                  }}>Transaction amount</span>
                  <span style={{ fontSize: 16, color: "var(--smx-color-disabled)",
                    fontFamily: "var(--smx-font-family)",
                    fontVariantNumeric: "tabular-nums" }}>$0.00</span>
                </div>
              </div>
            </div>

            <div style={{
              padding: "8px 16px", borderTop: "1px solid var(--smx-color-divider)",
              display: "flex", justifyContent: "flex-end", gap: 8
            }}>
              <MdBtn variant="text">Cancel</MdBtn>
              <MdBtn variant="filled">Next</MdBtn>
            </div>
          </div>
        ) : (
          // Bare component — just the selector and its selection table.
          <div style={{ width: "100%", maxWidth: 520 }}>
            <AccountSelector key={`${multiSelect}-${allowIndividualAccounts}`} config={config} />
          </div>
        )}
      </div>

      </div>
    </div>);

}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);