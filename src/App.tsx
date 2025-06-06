import React, { useState, useEffect, useMemo, type ChangeEvent } from 'react';
import {
  Box, Paper, Typography, TextField, ThemeProvider, createTheme,
  Grid, List, ListItemButton, ListItemText, Breadcrumbs, Link as MuiLink, Tooltip, IconButton,
  Accordion, AccordionSummary, AccordionDetails, Divider
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// --- Helper Functions ---
function getBit(value: number): number {
  if (value <= 0) return 0;
  if (value === 1) return 0;
  return Math.floor(Math.log2(value - 1)) + 1;
}

function parseUnitBasedSizeToBytes(sizeStr: string): number | string {
  if (!sizeStr.trim()) { return "Input is empty"; }
  const cleanedStr = sizeStr.trim().toUpperCase();
  const sizePattern = /^(\d+(?:\.\d+)?)\s*([KMGT])?([B])?$/;
  const match = cleanedStr.match(sizePattern);
  if (!match) { return "Invalid format. Example: 2GB, 512M, 1024KB, 2048B, or 4096 (Bytes)"; }
  const value = parseFloat(match[1]);
  const prefix = match[2] || '';
  const unitChar = match[3] || '';
  let multiplier = 1;
  if (prefix === 'K') multiplier = 1024;
  else if (prefix === 'M') multiplier = 1024 * 1024;
  else if (prefix === 'G') multiplier = 1024 * 1024 * 1024;
  else if (prefix !== '') return `Unknown prefix: ${prefix}`;
  if (unitChar !== 'B' && unitChar !== '') return `Invalid unit character: ${unitChar}`;
  const bytes = value * multiplier;
  if (bytes <= 0 || !isFinite(bytes) || isNaN(bytes)) { return "Cannot convert to a valid byte count (must be greater than 0)"; }
  return bytes;
}

function parseHexDataSizeToBytes(sizeStr: string): number | string {
  if (!sizeStr.trim()) { return "Size input is empty"; }
  const cleanedStr = sizeStr.trim().toLowerCase();
  let sizeBytes: number;
  if (cleanedStr.startsWith('0x')) {
    sizeBytes = parseInt(cleanedStr.substring(2), 16);
  } else {
    if (/^[0-9a-f]+$/.test(cleanedStr)) {
        sizeBytes = parseInt(cleanedStr, 16);
    } else {
        return "Invalid hexadecimal size. Expected e.g., 0x1000 or 1000 (hex bytes).";
    }
  }
  if (isNaN(sizeBytes) || sizeBytes <= 0 || !isFinite(sizeBytes)) {
    return "Invalid byte count from hex. Value must be a positive number.";
  }
  return sizeBytes;
}

function parseSizeInputToAddressBits(sizeStr: string): number | string {
    const bytes = parseUnitBasedSizeToBytes(sizeStr);
    if (typeof bytes === 'string') return bytes;
    return getBit(bytes);
}

function getBitValueFromAddress(address: number, bitPosition: number): number {
  if (isNaN(address) || isNaN(bitPosition) || bitPosition < 0) return 0;
  return (address >> bitPosition) & 1;
}

function parseNbitMappingToPositions(mappingStr: string): number[] | null {
  if (!mappingStr || !mappingStr.trim()) return null;
  const positions = mappingStr.split(',').map(s => parseInt(s.trim(), 10));
  if (positions.some(isNaN)) return null;
  return positions;
}

const HIERARCHY_ORDER = ["Channel", "Rank", "Bank", "BankGroup", "Subarray", "Row", "Column"];
const HIERARCHY_KEYS_LOWER = HIERARCHY_ORDER.map(s => s.toLowerCase());

function decodePhysicalAddress(
  physicalAddressHexStr: string,
  config: { channel: string[]; rank: string[]; bank: string[]; bankGroup: string[];
            subarray: string[]; row: string[]; column: string[]; }
): Record<string, number | string> {
  const decodedIDs: Record<string, number | string> = {};
  let physicalAddress: number;

  if (!physicalAddressHexStr.trim()) {
    HIERARCHY_KEYS_LOWER.forEach(key => decodedIDs[key] = "Address not entered");
    return decodedIDs;
  }
  if (physicalAddressHexStr.toLowerCase().startsWith('0x')) {
    physicalAddress = parseInt(physicalAddressHexStr.substring(2), 16);
  } else {
    physicalAddress = parseInt(physicalAddressHexStr, 16);
  }
  if (isNaN(physicalAddress)) {
    HIERARCHY_KEYS_LOWER.forEach(key => decodedIDs[key] = "Invalid address");
    return decodedIDs;
  }

  const processSection = (sectionNameKey: keyof typeof config) => {
    const nbitMappingStrings = config[sectionNameKey];
    const sectionKeyLower = sectionNameKey.toLowerCase();
    if (!nbitMappingStrings || nbitMappingStrings.length === 0) {
      decodedIDs[sectionKeyLower] = 0; return;
    }
    let idBinaryString = "";
    for (let i = 0; i < nbitMappingStrings.length; i++) {
      const mappingStr = nbitMappingStrings[i];
      const physicalBitPositions = parseNbitMappingToPositions(mappingStr);
      let currentIdBitValue = 0;
      if (physicalBitPositions && physicalBitPositions.length > 0) {
        if (physicalBitPositions.length > 1) {
          currentIdBitValue = physicalBitPositions.reduce((acc, pos) => acc ^ getBitValueFromAddress(physicalAddress, pos), 0);
        } else {
          currentIdBitValue = getBitValueFromAddress(physicalAddress, physicalBitPositions[0]);
        }
      }
      idBinaryString = currentIdBitValue.toString() + idBinaryString;
    }
    if (idBinaryString === "") {
      decodedIDs[sectionKeyLower] = nbitMappingStrings.length > 0 ? "Invalid mapping" : 0;
    } else {
      decodedIDs[sectionKeyLower] = parseInt(idBinaryString, 2);
    }
  };
  (Object.keys(config) as Array<keyof typeof config>).forEach(key => processSection(key));
  return decodedIDs;
}

const theme = createTheme();

interface VmConfig { baseAddress: string; size: string; }
interface PathItem { type: string; id: number; name: string; parentName?: string; }

const VM_COLORS = [
  'rgba(255, 105, 97, 0.7)',  'rgba(137, 207, 240, 0.7)', 'rgba(191, 255, 191, 0.7)',
  'rgba(255, 182, 193, 0.7)', 'rgba(255, 214, 151, 0.7)', 'rgba(177, 156, 217, 0.7)',
  'rgba(255, 255, 179, 0.7)', 'rgba(173, 216, 230, 0.7)',
];
const VM_CONFLICT_COLOR = 'rgba(100, 100, 100, 0.7)';
const UNUSED_COLUMN_COLOR = 'rgba(230, 230, 230, 0.7)';

interface ProcessedVmConfig extends VmConfig {
  id: number; baseAddressNum: number; endAddressNum: number; sizeBytes: number;
  color: string; decodedStart?: Record<string, number | string>;
  decodedEnd?: Record<string, number | string>; isValid: boolean;
}

interface AddressRange { start: number; end: number; }

function calculatePhysicalAddressRanges(
  itemFullPath: PathItem[],
  nbitValueStates: Record<string, string[]>,
  totalCapacityInBytes: number
): AddressRange[] {
  if (totalCapacityInBytes <= 0) {
    return [];
  }

  const activeHashGroups: { physicalBitPositions: number[]; targetIdBitValue: number; }[] = [];
  for (const pathSegment of itemFullPath) {
    const itemTypeLower = pathSegment.type.toLowerCase();
    const itemTargetId = pathSegment.id;
    const nbitMappings = nbitValueStates[itemTypeLower];
    const numIdBits = nbitMappings ? nbitMappings.length : 0;
    for (let i = 0; i < numIdBits; i++) {
      const targetIdBitValue = (itemTargetId >> i) & 1;
      const physicalBitPositions = parseNbitMappingToPositions(nbitMappings[i]);
      if (physicalBitPositions) {
        activeHashGroups.push({ physicalBitPositions, targetIdBitValue });
      }
    }
  }

  if (activeHashGroups.length === 0) {
    return [{ start: 0, end: totalCapacityInBytes - 1 }];
  }

  const allBits = new Set<number>();
  activeHashGroups.forEach(g => g.physicalBitPositions.forEach(b => allBits.add(b)));
  if (allBits.size === 0) {
    return [{ start: 0, end: totalCapacityInBytes - 1 }];
  }
  const relevantBits = Array.from(allBits);
  const minBit = Math.min(...relevantBits);
  const maxBit = Math.max(...relevantBits);

  const maxPossibleBitForCapacity = Math.floor(Math.log2(totalCapacityInBytes));
  if (maxBit > maxPossibleBitForCapacity) {
      console.warn(`A specified Nbit (${maxBit}) is outside the addressable range for the given capacity (${totalCapacityInBytes} bytes). Max possible bit is ${maxPossibleBitForCapacity}.`);
      return [];
  }

  if (maxBit - minBit > 24) {
    console.warn(`Bit range too large (${maxBit - minBit}). Skipping PA range calculation for performance.`);
    return [];
  }

  const calculatedRanges: AddressRange[] = [];
  const numCombinations = 1 << (maxBit - minBit + 1);
  let inTargetRange = false;
  let rangeStartAddr = 0;

  for (let i = 0; i < numCombinations; i++) {
    const currentBaseAddr = i << minBit;
    
    if (currentBaseAddr >= totalCapacityInBytes) {
      break;
    }
    
    let meetsAllCriteria = true;
    for (const group of activeHashGroups) {
      const currentXorSum = group.physicalBitPositions.reduce(
        (acc, bit) => acc ^ getBitValueFromAddress(currentBaseAddr, bit), 0
      );
      if (currentXorSum !== group.targetIdBitValue) {
        meetsAllCriteria = false;
        break;
      }
    }

    if (meetsAllCriteria && !inTargetRange) {
      inTargetRange = true;
      rangeStartAddr = currentBaseAddr;
    } else if (!meetsAllCriteria && inTargetRange) {
      inTargetRange = false;
      calculatedRanges.push({ start: rangeStartAddr, end: currentBaseAddr - 1 });
    }
  }

  if (inTargetRange) {
    calculatedRanges.push({ start: rangeStartAddr, end: totalCapacityInBytes - 1 });
  }

  return calculatedRanges;
}


const App: React.FC = () => {
  const initialChannelValue = 1; const initialRankValue = 1; const initialBankValue = 4;
  const initialBankGroupValue = 2; const initialSubarrayValue = 8;
  const initialRowValue = 16; const initialColumnRowValue = 32;

  const [sizeInput, setSizeInput] = useState<string>('');
  const [calculationResult, setCalculationResult] = useState<number | string | null>(null);
  const [physicalAddressInput, setPhysicalAddressInput] = useState<string>('');
  const [decodedIDs, setDecodedIDs] = useState<Record<string, number | string> | null>(null);

  const [bankValue, setBankValue] = useState<number>(initialBankValue);
  const [bankNbitValues, setBankNbitValues] = useState<string[]>(Array.from({ length: getBit(initialBankValue) }, () => ''));
  const [bankGroupValue, setBankGroupValue] = useState<number>(initialBankGroupValue);
  const [bankGroupNbitValues, setBankGroupNbitValues] = useState<string[]>(Array.from({ length: getBit(initialBankGroupValue) }, () => ''));
  const [rankValue, setRankValue] = useState<number>(initialRankValue);
  const [rankNbitValues, setRankNbitValues] = useState<string[]>(Array.from({ length: getBit(initialRankValue) }, () => ''));
  const [channelValue, setChannelValue] = useState<number>(initialChannelValue);
  const [channelNbitValues, setChannelNbitValues] = useState<string[]>(Array.from({ length: getBit(initialChannelValue) }, () => ''));
  const [subarrayValue, setSubarrayValue] = useState<number>(initialSubarrayValue);
  const [subarrayNbitValues, setSubarrayNbitValues] = useState<string[]>(Array.from({ length: getBit(initialSubarrayValue) }, () => ''));
  const [rowValue, setRowValue] = useState<number>(initialRowValue);
  const [rowNbitValues, setRowNbitValues] = useState<string[]>(Array.from({ length: getBit(initialRowValue) }, () => ''));
  const [columnRowValue, setColumnValue] = useState<number>(initialColumnRowValue);
  const [columnRowNbitValues, setColumnNbitValues] = useState<string[]>(Array.from({ length: getBit(initialColumnRowValue) }, () => ''));

  const [vmCount, setVmCount] = useState<number>(0);
  const [vmConfigs, setVmConfigs] = useState<VmConfig[]>([]);
  const [processedVmConfigs, setProcessedVmConfigs] = useState<ProcessedVmConfig[]>([]);

  const [currentView, setCurrentView] = useState<string>(HIERARCHY_ORDER[0]);
  const [navigationPath, setNavigationPath] = useState<PathItem[]>([]);
  const [selectedElementInfo, setSelectedElementInfo] = useState<any | null>(null);

  const valueStates: Record<string, number> = useMemo(() => ({
    Channel: channelValue, Rank: rankValue, Bank: bankValue, BankGroup: bankGroupValue,
    Subarray: subarrayValue, Row: rowValue, Column: columnRowValue,
  }), [channelValue, rankValue, bankValue, bankGroupValue, subarrayValue, rowValue, columnRowValue]);
  
  const nbitValueStates = useMemo(() => ({
      channel: channelNbitValues, rank: rankNbitValues, bank: bankNbitValues,
      bankGroup: bankGroupNbitValues, subarray: subarrayNbitValues,
      row: rowNbitValues, column: columnRowNbitValues,
  }), [channelNbitValues, rankNbitValues, bankNbitValues, bankGroupNbitValues, subarrayNbitValues, rowNbitValues, columnRowNbitValues]);

  const totalCapacityInBytes = useMemo(() => {
    const bytes = parseUnitBasedSizeToBytes(sizeInput);
    return typeof bytes === 'number' && bytes > 0 ? bytes : 0;
  }, [sizeInput]);

  const handleSizeInputChange = (event: ChangeEvent<HTMLInputElement>) => setSizeInput(event.target.value);
  const handlePhysicalAddressChange = (event: ChangeEvent<HTMLInputElement>) => setPhysicalAddressInput(event.target.value);

  const createValueChangeHandler = (setValue: React.Dispatch<React.SetStateAction<number>>, setNbitValues: React.Dispatch<React.SetStateAction<string[]>>) => (event: ChangeEvent<HTMLInputElement>) => { const numValue = parseInt(event.target.value, 10); const validValue = isNaN(numValue) || numValue < 0 ? 0 : numValue; setValue(validValue); const bitCount = getBit(validValue); setNbitValues(Array.from({ length: bitCount }, () => '')); };
  const createNbitChangeHandler = (nbitValues: string[], setNbitValues: React.Dispatch<React.SetStateAction<string[]>>) => (index: number, value: string) => { const newValues = [...nbitValues]; newValues[index] = value; setNbitValues(newValues); };

  const handleRankChange = createValueChangeHandler(setRankValue, setRankNbitValues);
  const handleRankNbitChange = createNbitChangeHandler(rankNbitValues, setRankNbitValues);
  const handleBankChange = createValueChangeHandler(setBankValue, setBankNbitValues);
  const handleBankNbitChange = createNbitChangeHandler(bankNbitValues, setBankNbitValues);
  const handleBankGroupChange = createValueChangeHandler(setBankGroupValue, setBankGroupNbitValues);
  const handleBankGroupNbitChange = createNbitChangeHandler(bankGroupNbitValues, setBankGroupNbitValues);
  const handleChannelChange = createValueChangeHandler(setChannelValue, setChannelNbitValues);
  const handleChannelNbitChange = createNbitChangeHandler(channelNbitValues, setChannelNbitValues);
  const handleSubarrayChange = createValueChangeHandler(setSubarrayValue, setSubarrayNbitValues);
  const handleSubarrayNbitChange = createNbitChangeHandler(subarrayNbitValues, setSubarrayNbitValues);
  const handleRowChange = createValueChangeHandler(setRowValue, setRowNbitValues);
  const handleRowNbitChange = createNbitChangeHandler(rowNbitValues, setRowNbitValues);
  const handleColumnRowChange = createValueChangeHandler(setColumnValue, setColumnNbitValues);
  const handleColumnRowNbitChange = createNbitChangeHandler(columnRowNbitValues, setColumnNbitValues);

  const handleVmCountChange = (event: ChangeEvent<HTMLInputElement>) => { let count = parseInt(event.target.value, 10); if (isNaN(count) || count < 0) count = 0; setVmCount(count); setVmConfigs(prevConfigs => { const newArray: VmConfig[] = []; for (let i = 0; i < count; i++) { newArray.push(prevConfigs[i] || { baseAddress: '', size: '' }); } return newArray; }); };
  const handleVmConfigChange = (index: number, field: keyof VmConfig, value: string) => { setVmConfigs(prevConfigs => { const newConfigs = [...prevConfigs]; if (newConfigs[index]) newConfigs[index] = { ...newConfigs[index], [field]: value }; return newConfigs; }); };

  const handleElementSelect = (elementType: string, elementId: number) => { const elementName = `${elementType}${elementId}`; const parentName = navigationPath.length > 0 ? navigationPath[navigationPath.length - 1].name : 'System'; const newPathItem: PathItem = { type: elementType, id: elementId, name: elementName, parentName }; const newPath = [...navigationPath, newPathItem]; setNavigationPath(newPath); const currentTypeIndex = HIERARCHY_ORDER.indexOf(elementType); if (currentTypeIndex < HIERARCHY_ORDER.length - 1) { setCurrentView(HIERARCHY_ORDER[currentTypeIndex + 1]); } else { setCurrentView(elementType); } setSelectedElementInfo({ ...newPathItem, fullPath: newPath.map(p => p.name).join(' > ') }); };
  const navigateToPathIndex = (index: number) => { const newPath = navigationPath.slice(0, index + 1); setNavigationPath(newPath); if (index < 0) { setCurrentView(HIERARCHY_ORDER[0]); setSelectedElementInfo(null); return; } const targetElement = newPath[newPath.length - 1]; const currentTypeIndex = HIERARCHY_ORDER.indexOf(targetElement.type); if (currentTypeIndex < HIERARCHY_ORDER.length - 1) { setCurrentView(HIERARCHY_ORDER[currentTypeIndex + 1]); } else { setCurrentView(targetElement.type); } setSelectedElementInfo({...targetElement, fullPath: newPath.map(p=>p.name).join(' > ')}); };

  useEffect(() => { const result = parseSizeInputToAddressBits(sizeInput); setCalculationResult(result); }, [sizeInput]);
  useEffect(() => { const result = decodePhysicalAddress(physicalAddressInput, nbitValueStates); setDecodedIDs(result); }, [physicalAddressInput, nbitValueStates]);
  
  useEffect(() => {
    const newProcessedVmConfigs = vmConfigs.map((vm, index) => {
      let baseAddressNum = NaN; let sizeBytesNum = 0; let isValid = false;
      if (vm.baseAddress.trim()) { baseAddressNum = vm.baseAddress.toLowerCase().startsWith('0x') ? parseInt(vm.baseAddress.substring(2), 16) : parseInt(vm.baseAddress, 16); }
      const parsedSizeBytes = parseHexDataSizeToBytes(vm.size); 
      if (typeof parsedSizeBytes === 'number' && !isNaN(baseAddressNum) && parsedSizeBytes > 0) { sizeBytesNum = parsedSizeBytes; isValid = true; }
      return {
        ...vm, id: index, baseAddressNum: isValid ? baseAddressNum : NaN,
        sizeBytes: sizeBytesNum, endAddressNum: isValid ? baseAddressNum + sizeBytesNum - 1 : NaN,
        color: VM_COLORS[index % VM_COLORS.length], isValid: isValid,
      };
    });
    setProcessedVmConfigs(newProcessedVmConfigs);
  }, [vmConfigs]);

  const totalNbitSum = useMemo(() => (
    getBit(rankValue) + getBit(bankValue) + getBit(bankGroupValue) +
    getBit(channelValue) + getBit(subarrayValue) + getBit(rowValue) + getBit(columnRowValue)
  ), [rankValue, bankValue, bankGroupValue, channelValue, subarrayValue, rowValue, columnRowValue]);
  
  const itemAddressRanges = useMemo(() => {
    const count = valueStates[currentView] ?? 0;
    const rangesMap = new Map<number, AddressRange[]>();
    if (totalCapacityInBytes > 0) {
        for (let i = 0; i < count; i++) {
            const itemFullPath = [...navigationPath, { type: currentView, id: i, name: `${currentView}${i}` }];
            rangesMap.set(i, calculatePhysicalAddressRanges(itemFullPath, nbitValueStates, totalCapacityInBytes));
        }
    }
    return rangesMap;
  }, [currentView, navigationPath, nbitValueStates, valueStates, totalCapacityInBytes]);
  
  let consistencyStatusText: string = ''; let consistencyStatusColor: string = 'text.secondary'; let consistencyMessageDetail: string = '';
  if (typeof calculationResult === 'number') {
    consistencyMessageDetail = `Address bits from capacity: ${calculationResult} bits`;
    if (totalNbitSum === calculationResult) { consistencyStatusText = 'Status: Consistent'; consistencyStatusColor = 'success.main'; } 
    else { consistencyStatusText = 'Status: Inconsistent'; consistencyStatusColor = 'error.main'; }
  } else {
    consistencyMessageDetail = `Address bits from capacity: (Not calculated or ${calculationResult || 'invalid'})`;
    consistencyStatusText = 'Status: Cannot compare; bits from capacity are not calculated or invalid.';
    consistencyStatusColor = 'warning.main';
  }

  const renderSection = (
    title: string, value: number, onValueChange: (event: ChangeEvent<HTMLInputElement>) => void,
    nbitValues: string[], onNbitValueChange: (index: number, value: string) => void, idPrefix: string
  ) => (
    <Paper elevation={2} sx={{ p: 2, minWidth: '150px', width: "220px", }}>
      <Typography variant="h6" component="h2" gutterBottom>{title}</Typography>
      <TextField label="Value" type="number" id={`${idPrefix}-value-input`} value={value === 0 ? '' : value} onChange={onValueChange} InputProps={{ inputProps: { min: 0 } }} variant="outlined" size="small" sx={{ mb: 2, minWidth: '100px', maxWidth: '120px' }} />
      {getBit(value) > 0 && (
        <Box sx={{ mt: 1, pl: 1, borderLeft: '2px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" sx={{ mb: 1, ml: 1 }}>Bits (PA Bit Pos):</Typography>
          {Array.from({ length: getBit(value) }, (_, index) => (
            <Box key={`${idPrefix}-nbit-${index}`} sx={{ display: 'flex', alignItems: 'center', mb: 1, ml: 1 }}>
              <Typography variant="body2" component="label" htmlFor={`${idPrefix}-nbit-input-${index}`} sx={{ mr: 1, minWidth: '80px', fontSize: '0.875rem', whiteSpace: 'nowrap', }}>{title}{index}bit</Typography>
              <TextField type="text" placeholder="e.g., 5 or 0,2" id={`${idPrefix}-nbit-input-${index}`} 
                value={nbitValues[index] === undefined ? '' : nbitValues[index]} 
                onChange={(event) => onNbitValueChange(index, event.target.value)}
                variant="outlined" size="small" sx={{ minWidth: '100px', maxWidth: '150px' }} />
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );

  const ItemGridView = ({ count, itemShortName, currentItemType }: { count: number, itemName: string, itemShortName: string, currentItemType: string }) => {
    return (
      <Grid container spacing={1} sx={{p:1}}>
        {Array.from({ length: count }).map((_, index) => {
          const itemPaRanges = itemAddressRanges.get(index) || [];
          const vmsUsingThisItem = processedVmConfigs.filter(vm => vm.isValid && itemPaRanges.some(itemRange => (vm.baseAddressNum <= itemRange.end && vm.endAddressNum >= itemRange.start)));
          let itemStyle: React.CSSProperties = { cursor: 'pointer', transition: 'background 0.3s' };
          if (vmsUsingThisItem.length === 1) { itemStyle.backgroundColor = vmsUsingThisItem[0].color; } 
          else if (vmsUsingThisItem.length > 1) {
            const colors = vmsUsingThisItem.map(vm => vm.color);
            const stripeSize = 100 / colors.length;
            itemStyle.background = `linear-gradient(45deg, ${colors.map((c, i) => `${c} ${i * stripeSize}%, ${c} ${(i + 1) * stripeSize}%`).join(', ')})`;
          }
          return (
            <Grid key={index} size={{ xs: 3, sm: 2, md: 1.5, lg: 1}}>
              <Paper variant="outlined" sx={{ p: 1, minHeight: 30, display:'flex', alignItems:'center', justifyContent:'center', '&:hover': { boxShadow: 3, borderColor: 'primary.main' }, ...itemStyle }} onClick={() => handleElementSelect(currentItemType, index)}>
                <Typography variant="caption" component="div">{itemShortName}{index}</Typography>
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    );
  };

  const RowListView = ({ count }: { count: number }) => {
    return (
      <List sx={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #ccc', borderRadius: 1, m:1, p:0 }}>
        {Array.from({ length: count }).map((_, index) => {
          const itemPaRanges = itemAddressRanges.get(index) || [];
          const vmsUsingThisItem = processedVmConfigs.filter(vm => vm.isValid && itemPaRanges.some(r => (vm.baseAddressNum <= r.end && vm.endAddressNum >= r.start)));
          let itemStyle: React.CSSProperties = {cursor: 'pointer', paddingTop: '4px', paddingBottom: '4px'};
          if (vmsUsingThisItem.length === 1) itemStyle.backgroundColor = vmsUsingThisItem[0].color;
          else if (vmsUsingThisItem.length > 1) {
            const colors = vmsUsingThisItem.map(vm => vm.color);
            if (colors.length > 0) { const stripes = colors.map((color, i, arr) => `${color} ${(i * 100) / arr.length}%, ${color} ${((i + 1) * 100) / arr.length}%`).join(', '); itemStyle.background = `linear-gradient(45deg, ${stripes})`; }
          }
          return ( <ListItemButton key={index} onClick={() => handleElementSelect("Row", index)} dense sx={itemStyle}> <ListItemText primary={`Row ${index}`} /> </ListItemButton> );
        })}
      </List>
    );
  };

  const ColumnGridView = ({ count }: { count: number }) => {
    return (
      <Grid container spacing={0.2} sx={{p:0.5, border:'1px solid #ddd', borderRadius:1, maxHeight: 400, overflowY: 'auto'}}>
        {Array.from({ length: count }).map((_, index) => {
          const itemPaRanges = itemAddressRanges.get(index) || [];
          const vmsUsingThisItem = processedVmConfigs.filter(vm => vm.isValid && itemPaRanges.some(r => (vm.baseAddressNum <= r.end && vm.endAddressNum >= r.start)));
          let itemStyle: React.CSSProperties = { width: 8, height: 8, cursor: 'pointer', border: '1px solid #bbb'};
          let tooltipTitle = `Column ${index}`;
           if (vmsUsingThisItem.length === 1) {
             itemStyle.backgroundColor = vmsUsingThisItem[0].color;
             tooltipTitle += ` (VM ${vmsUsingThisItem[0].id + 1})`;
           } else if (vmsUsingThisItem.length > 1) {
             itemStyle.backgroundColor = VM_CONFLICT_COLOR; 
             tooltipTitle += ` (Conflict: Used by ${vmsUsingThisItem.length} VMs)`;
           } else {
             itemStyle.backgroundColor = UNUSED_COLUMN_COLOR;
           }
          return (
            <Grid key={index}>
              <Tooltip title={tooltipTitle} placement="top" arrow>
                <Box sx={itemStyle} onClick={() => {
                    const colName = `Column${index}`; const parentName = navigationPath[navigationPath.length-1]?.name;
                    const fullPathObj = [...navigationPath, {type: "Column", id: index, name: colName, parentName }];
                    setSelectedElementInfo({ type: "Column", id: index, name: colName, parent: parentName, path: fullPathObj.map(p=>p.name).join(' > ') });
                  }} />
              </Tooltip>
            </Grid>
          );
        })}
      </Grid>
    );
  };

  const renderDrillDownView = () => {
    const parentItem = navigationPath.length > 0 ? navigationPath[navigationPath.length - 1] : null;
    let viewTitlePrefix = parentItem ? `${currentView}s in ${parentItem.name}` : `${currentView}s`;
    if (navigationPath.length === 0 && currentView === HIERARCHY_ORDER[0]) {
        viewTitlePrefix = `${HIERARCHY_ORDER[0]}s (System Root)`;
    }
    const count = valueStates[currentView] ?? 0;
    return ( <Box> <Typography variant="h6" gutterBottom>{viewTitlePrefix}</Typography>
            {(() => {
                switch (currentView) {
                    case "Channel": return <ItemGridView count={count} itemName="Channel" itemShortName="Ch" currentItemType="Channel" />;
                    case "Rank": return <ItemGridView count={count} itemName="Rank" itemShortName="Rk" currentItemType="Rank" />;
                    case "Bank": return <ItemGridView count={count} itemName="Bank" itemShortName="Bk" currentItemType="Bank" />;
                    case "BankGroup": return <ItemGridView count={count} itemName="BankGroup" itemShortName="BG" currentItemType="BankGroup" />;
                    case "Subarray": return <ItemGridView count={count} itemName="Subarray" itemShortName="SA" currentItemType="Subarray" />;
                    case "Row": return <RowListView count={count} />;
                    case "Column": return <ColumnGridView count={count} />;
                    default: return <ItemGridView count={channelValue} itemName={HIERARCHY_ORDER[0]} itemShortName={HIERARCHY_ORDER[0].substring(0,2)} currentItemType={HIERARCHY_ORDER[0]} />;
                }
            })()} </Box>
    );
  };
  const BreadcrumbNav = () => (
    <Box sx={{display:'flex', alignItems: 'center', mb:1}}>
        {navigationPath.length > 0 && ( <IconButton onClick={() => navigateToPathIndex(navigationPath.length - 2)} size="small" sx={{mr:1}} aria-label="Go back"> <ArrowBackIcon /> </IconButton> )}
        <Breadcrumbs aria-label="breadcrumb">
          <MuiLink component="button" variant="body2" onClick={() => navigateToPathIndex(-1)} sx={{cursor:'pointer'}}> System </MuiLink>
          {navigationPath.map((item, index) => ( <MuiLink component="button" variant="body2" key={`${item.type}-${item.id}`} onClick={() => navigateToPathIndex(index)} sx={{cursor:'pointer'}}> {item.name} </MuiLink> ))}
        </Breadcrumbs>
    </Box>
  );
  const InformationPanel = () => {
    if (!selectedElementInfo) { return <Typography color="text.secondary">Select an element to see details.</Typography>; }
    return (<> <Typography variant="h6" gutterBottom>Details</Typography> {Object.entries(selectedElementInfo).map(([key, value]) => ( <Typography key={key} variant="body2" sx={{overflowWrap: 'break-word'}}> <strong>{key.charAt(0).toUpperCase() + key.slice(1)}:</strong> {String(value)} </Typography>))} </>);
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ p: 2, display: 'flex', gap: 2, backgroundColor: 'grey.100', minHeight: '100vh', boxSizing: 'border-box' }}>
        
        {/* Left Column: Configuration Panels */}
        <Paper elevation={2} sx={{ width: '30%', minWidth: 400, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 32px)', overflowY: 'auto' }}>
            <Typography variant="h5" sx={{p:2, borderBottom: '1px solid', borderColor: 'divider'}}>Configuration</Typography>
            
            <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography fontWeight="medium">System & VM</Typography></AccordionSummary>
                <AccordionDetails sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
                    <TextField label="Total Capacity (e.g., 2GB)" variant="outlined" size="small" value={sizeInput} onChange={handleSizeInputChange} />
                    <Divider sx={{my:1}} />
                    <Typography variant="h6" sx={{mt:1}}>Virtual Machine Configuration</Typography>
                    <TextField label="Number of VMs" type="number" value={vmCount === 0 ? '' : vmCount} onChange={handleVmCountChange} InputProps={{ inputProps: { min: 0 } }} variant="outlined" size="small" sx={{ width: '180px' }}/>
                    {vmConfigs.map((config, index) => (
                      <Box key={`vm-${index}`} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography variant="body2" sx={{ minWidth: '50px', fontWeight:'bold', color: VM_COLORS[index % VM_COLORS.length].replace('0.7)', '1)') }}>VM {index + 1}</Typography>
                        <TextField label={`Base Address`} value={config.baseAddress} onChange={(e) => handleVmConfigChange(index, 'baseAddress', e.target.value)} variant="outlined" size="small" placeholder="e.g., 0x1000" sx={{ flexGrow: 1, minWidth: '120px' }}/>
                        <TextField label={`Size (Hex Bytes)`} value={config.size} onChange={(e) => handleVmConfigChange(index, 'size', e.target.value)} variant="outlined" size="small" placeholder="e.g., 0x1000" sx={{ flexGrow: 1, minWidth: '120px' }}/>
                      </Box>
                    ))}
                </AccordionDetails>
            </Accordion>
            
            <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography fontWeight="medium">DRAM Address Mapping</Typography></AccordionSummary>
                <AccordionDetails>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {renderSection("Channel", channelValue, handleChannelChange, channelNbitValues, handleChannelNbitChange, "channel")}
                        {renderSection("Rank", rankValue, handleRankChange, rankNbitValues, handleRankNbitChange, "rank")}
                        {renderSection("Bank", bankValue, handleBankChange, bankNbitValues, handleBankNbitChange, "bank")}
                        {renderSection("BankGroup", bankGroupValue, handleBankGroupChange, bankGroupNbitValues, handleBankGroupNbitChange, "bankgroup")}
                        {renderSection("Subarray", subarrayValue, handleSubarrayChange, subarrayNbitValues, handleSubarrayNbitChange, "subarray")}
                        {renderSection("Row", rowValue, handleRowChange, rowNbitValues, handleRowNbitChange, "row")}
                        {renderSection("Column", columnRowValue, handleColumnRowChange, columnRowNbitValues, handleColumnRowNbitChange, "column")}
                    </Box>
                </AccordionDetails>
            </Accordion>
        </Paper>

        {/* Center & Right Columns */}
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2, height: 'calc(100vh - 32px)' }}>
            <Paper elevation={2} sx={{ flex: '1 1 60%', p:2, display:'flex', flexDirection:'column', overflow:'hidden' }}>
                <Typography variant="h5" component="h2" gutterBottom>DRAM Hierarchy Visualizer</Typography>
                <BreadcrumbNav />
                <Box sx={{ flexGrow: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1, overflowY: 'auto' }}>
                    {renderDrillDownView()}
                </Box>
            </Paper>
            <Box sx={{ flex: '1 1 40%', display: 'flex', gap: 2, overflow:'hidden' }}>
                 <Paper elevation={2} sx={{ p: 2, flex: 1, overflowY:'auto' }}>
                    <Typography variant="h6" gutterBottom>Information Panel</Typography>
                    <Divider sx={{mb:2}}/>
                    <InformationPanel />
                 </Paper>
                 <Paper elevation={2} sx={{ p: 2, flex: 1, overflowY:'auto' }}>
                    <Typography variant="h6" gutterBottom>Analysis & Checks</Typography>
                    <Divider sx={{mb:2}}/>
                    <Typography variant="subtitle1" gutterBottom>Bit Count Consistency</Typography>
                    <Typography variant="body2">{`Total configured bits from settings: ${totalNbitSum}`}</Typography>
                    <Typography variant="body2">{consistencyMessageDetail.replace('Address bits from capacity:', 'Capacity requires:')}</Typography>
                    <Typography variant="body2" sx={{ color: consistencyStatusColor, fontWeight: 'bold', mt:0.5 }}>{consistencyStatusText}</Typography>
                    <Divider sx={{my:2}}/>
                    <Typography variant="subtitle1" gutterBottom>Physical Address Decode</Typography>
                    <TextField
                        label="Physical Address to Decode" variant="outlined" size="small"
                        value={physicalAddressInput} onChange={handlePhysicalAddressChange}
                        helperText="Enter in hexadecimal (e.g., 0x110)"
                        sx={{ mt: 1, mb: 2, width: '100%' }} />
                    {decodedIDs ? (Object.entries(decodedIDs).map(([key, value]) => (<Typography key={key} variant="caption" component="div"><strong>{key.charAt(0).toUpperCase() + key.slice(1)} ID:</strong> {String(value)}</Typography>))) : (<Typography variant="body2" color="text.secondary">Enter a Physical Address above.</Typography>)}
                 </Paper>
            </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default App;