
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend as RechartsLegend, ResponsiveContainer } from 'recharts';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Info, Loader2, Printer, Sparkles, RefreshCw } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { StepIndicator } from '@/components/material-wise/step-indicator';
import { materialsDb, allCriteria, pressureNominalValues, type Material, type CriterionKey, type Criterion } from '@/lib/materials';
import { runTopsisCalculation, type TopsisFullResults, type TopsisResult } from '@/lib/topsis';
import { CriteriaIcons, NetworkTypeIcons } from '@/components/material-wise/icons';
import { suggestMaterialCosts, type SuggestMaterialCostsInput, type SuggestMaterialCostsOutput } from '@/ai/flows/suggest-material-costs';
import Image from 'next/image';

type NetworkMainType = 'Alimentation' | 'Evacuation';
type AlimentationSubtype = 'EF' | 'ECS';
type EvacuationSubtype = 'Eaux usées et vannes' | 'Eaux pluviales';

const stepNames = ["Type de Réseau", "Spécifications", "Matériaux", "Critères", "Coûts & Poids", "Résultats"];

export default function MaterialWisePage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [networkMainType, setNetworkMainType] = useState<NetworkMainType | null>(null);
  const [selectedSubtype, setSelectedSubtype] = useState<string | null>(null);
  const [selectedPN, setSelectedPN] = useState<number | null>(null);
  
  const [availableMaterials, setAvailableMaterials] = useState<Material[]>([]);
  const [selectedMaterialNames, setSelectedMaterialNames] = useState<string[]>([]);
  
  const [selectableCriteria, setSelectableCriteria] = useState<Criterion[]>([]);
  const [selectedCriteriaKeys, setSelectedCriteriaKeys] = useState<CriterionKey[]>([]);
  
  const [materialCosts, setMaterialCosts] = useState<Record<string, string>>({});
  const [criteriaWeights, setCriteriaWeights] = useState<Record<CriterionKey, string>>({});

  const [topsisResults, setTopsisResults] = useState<TopsisFullResults[] | null>(null);
  const [calculationDetails, setCalculationDetails] = useState<Omit<TopsisFullResults, keyof TopsisResult | 'name' | 'score' | 'originalData' | 'calculatedValues'> | null>(null);

  const [costSuggestions, setCostSuggestions] = useState<Record<string, string>>({});
  const [isSuggestingCost, setIsSuggestingCost] = useState<Record<string, boolean>>({});
  
  const { toast } = useToast();

  useEffect(() => {
    if (networkMainType && selectedSubtype) {
      let filtered: Material[] = [];
      if (networkMainType === 'Evacuation') {
        // For Evacuation, filter only by type 'EV'. PN is not used for filtering materials.
        filtered = materialsDb.filter(m => m.type.includes('EV'));
        setSelectedPN(null); // Ensure PN is reset if switching to Evacuation
      } else if (networkMainType === 'Alimentation' && selectedPN !== null) { 
        // For Alimentation, subtype and PN are required
        const mappedType = selectedSubtype; // EF or ECS
        filtered = materialsDb.filter(m =>
          m.type.includes(mappedType as string) && m.pn.includes(selectedPN)
        );
      } else if (networkMainType === 'Alimentation' && selectedPN === null) {
        // PN not yet selected for Alimentation, so no materials yet
        filtered = [];
      }
      setAvailableMaterials(filtered);
      setSelectedMaterialNames([]); 
    } else {
      setAvailableMaterials([]);
    }
  }, [networkMainType, selectedSubtype, selectedPN]);

  useEffect(() => {
    let criteriaToUse = [...allCriteria];
    
    // 'temp' criterion is only for 'ECS' subtype
    if (selectedSubtype !== 'ECS') {
      criteriaToUse = criteriaToUse.filter(c => c.key !== 'temp');
    }
  
    // 'surpression' criterion is not for 'Evacuation' network type
    if (networkMainType === 'Evacuation') {
      criteriaToUse = criteriaToUse.filter(c => c.key !== 'surpression');
    }
    
    setSelectableCriteria(criteriaToUse);
    // Reset selected criteria only if the available criteria list actually changes
    // This prevents resetting selections if, for example, only PN changes but criteria remain the same
    const currentSelectedStillValid = selectedCriteriaKeys.every(key => criteriaToUse.some(c => c.key === key));
    if (!currentSelectedStillValid) {
        setSelectedCriteriaKeys([]);
    }

  }, [networkMainType, selectedSubtype, selectedCriteriaKeys]);


  const handleNextStep = () => {
    if (currentStep === 1 && !networkMainType) {
      toast({ title: "Erreur", description: "Veuillez choisir un type de réseau.", variant: "destructive" });
      return;
    }
    if (currentStep === 2 && (!selectedSubtype || (networkMainType === 'Alimentation' && selectedPN === null))) {
      toast({ title: "Erreur", description: "Veuillez sélectionner un sous-type et une pression nominale pour Alimentation, ou un sous-type pour Evacuation.", variant: "destructive" });
      return;
    }
     if (currentStep === 2 && availableMaterials.length === 0 && (networkMainType === 'Alimentation' && selectedPN !== null || networkMainType === 'Evacuation')) {
       toast({ title: "Information", description: "Aucun matériau compatible trouvé pour les spécifications sélectionnées. Essayez d'autres options.", variant: "default" });
       return; 
    }
    if (currentStep === 3 && selectedMaterialNames.length === 0) {
      toast({ title: "Erreur", description: "Veuillez sélectionner au moins un matériau.", variant: "destructive" });
      return;
    }
    if (currentStep === 4 && selectedCriteriaKeys.length === 0) {
      toast({ title: "Erreur", description: "Veuillez sélectionner au moins un critère.", variant: "destructive" });
      return;
    }
    if (currentStep === 5) {
      const costsValid = selectedMaterialNames.every(name => materialCosts[name] && !isNaN(parseFloat(materialCosts[name])) && parseFloat(materialCosts[name]) >= 0);
      if (!costsValid) {
        toast({ title: "Erreur de Coût", description: "Veuillez entrer des coûts valides (nombres positifs) pour tous les matériaux sélectionnés.", variant: "destructive" });
        return;
      }
      
      let totalWeight = 0;
      const weightsValid = selectedCriteriaKeys.every(key => {
        const weightVal = parseFloat(criteriaWeights[key]);
        if (criteriaWeights[key] && !isNaN(weightVal) && weightVal >= 0 && weightVal <=1) {
          totalWeight += weightVal;
          return true;
        }
        return false;
      });

      if (!weightsValid) {
        toast({ title: "Erreur de Pondération", description: "Veuillez entrer des pondérations valides (entre 0 et 1) pour tous les critères sélectionnés.", variant: "destructive" });
        return;
      }
      if (Math.abs(totalWeight - 1.0) > 0.001) { // Using a small tolerance for floating point comparison
         toast({ title: "Erreur de Pondération", description: `La somme des pondérations (${totalWeight.toFixed(3)}) doit être égale à 1.00.`, variant: "destructive" });
         return;
      }
      
      const selectedMaterialsData = materialsDb.filter(m => selectedMaterialNames.includes(m.name));
      const costsParsed = Object.fromEntries(Object.entries(materialCosts).map(([key, value]) => [key, parseFloat(value)]));
      const weightsParsed = Object.fromEntries(Object.entries(criteriaWeights).map(([key, value]) => [key as CriterionKey, parseFloat(value)]));
      
      const results = runTopsisCalculation({
        selectedMaterialsData,
        selectedCriteriaKeys,
        allCriteriaDefinition: selectableCriteria, // Use the dynamically filtered criteria
        costs: costsParsed,
        weights: weightsParsed,
      });
      setTopsisResults(results);
      if (results.length > 0) {
        // Assuming all results in the array share the same detailed matrices
        setCalculationDetails(results[0]); 
      } else {
        setCalculationDetails(null);
      }
    }
    setCurrentStep(s => s + 1);
  };

  const handlePrevStep = () => setCurrentStep(s => s - 1);

  const handleRestart = () => {
    setCurrentStep(1);
    setNetworkMainType(null);
    setSelectedSubtype(null);
    setSelectedPN(null);
    setAvailableMaterials([]);
    setSelectedMaterialNames([]);
    setSelectableCriteria(allCriteria); // Reset to all default criteria
    setSelectedCriteriaKeys([]);
    setMaterialCosts({});
    setCriteriaWeights({});
    setTopsisResults(null);
    setCostSuggestions({});
    setIsSuggestingCost({});
    setCalculationDetails(null);
    toast({ title: "Réinitialisation", description: "Le formulaire a été réinitialisé.", variant: "default" });
  };

  const handleMaterialSelection = (materialName: string) => {
    setSelectedMaterialNames(prev =>
      prev.includes(materialName)
        ? prev.filter(name => name !== materialName)
        : [...prev, materialName]
    );
  };

  const handleCriteriaSelection = (criterionKey: CriterionKey) => {
    setSelectedCriteriaKeys(prev =>
      prev.includes(criterionKey)
        ? prev.filter(key => key !== criterionKey)
        : [...prev, criterionKey]
    );
  };

  const handleSuggestCost = async (materialName: string) => {
    const material = availableMaterials.find(m => m.name === materialName);
    // Cost suggestion requires PN. For 'Evacuation', PN is not selected by the user in step 2.
    // Therefore, this button will be disabled if selectedPN is null.
    if (!material || selectedPN === null) { 
      toast({ title: "Erreur", description: "Impossible de suggérer le coût. Pression Nominale (PN) requise.", variant: "destructive"});
      return;
    }

    setIsSuggestingCost(prev => ({ ...prev, [materialName]: true }));
    try {
      const input: SuggestMaterialCostsInput = {
        materialType: material.name, // Using material.name as it might be more specific than a general type
        pressureRating: selectedPN, // selectedPN is guaranteed to be a number here by the check above
      };
      const suggestion: SuggestMaterialCostsOutput = await suggestMaterialCosts(input);
      setCostSuggestions(prev => ({...prev, [materialName]: suggestion.costRange}));
      toast({ title: "Suggestion de Coût", description: `Pour ${materialName}: ${suggestion.costRange}`, duration: 5000 });
    } catch (error) {
      console.error("Error suggesting cost:", error);
      toast({ title: "Erreur IA", description: "Impossible de récupérer la suggestion de coût.", variant: "destructive"});
    } finally {
      setIsSuggestingCost(prev => ({ ...prev, [materialName]: false }));
    }
  };
  
  const renderMatrixAsTable = (
    matrix: number[][],
    rowHeaders: string[], 
    colHeaders: string[], 
    caption: string,
    decimalPlaces: number = 2
  ) => (
    <div className="my-4">
      <h4 className="font-semibold mb-2 text-sm">{caption}:</h4>
      {matrix && matrix.length > 0 && matrix[0].length > 0 ? (
        <Table className="text-xs border">
          <TableHeader>
            <TableRow>
              <TableHead className="border">Matériau</TableHead>
              {colHeaders.map(header => <TableHead key={header} className="text-right border">{header}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {matrix.map((row, rowIndex) => (
              <TableRow key={rowHeaders[rowIndex] || `row-${rowIndex}`}>
                <TableCell className="font-medium border">{rowHeaders[rowIndex] || `Matériau ${rowIndex + 1}`}</TableCell>
                {row.map((cell, cellIndex) => (
                  <TableCell key={`cell-${rowIndex}-${cellIndex}`} className="text-right border">
                    {cell.toFixed(decimalPlaces)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : <p className="text-xs text-muted-foreground">Données non disponibles.</p>}
    </div>
  );

  const renderVectorAsTable = (
    vector: number[],
    rowHeaders: string[], 
    caption: string,
    valueHeader: string = "Valeur",
    labelHeader: string = "Item",
    decimalPlaces: number = 3
  ) => (
    <div className="my-4">
      <h4 className="font-semibold mb-2 text-sm">{caption}:</h4>
      {vector && vector.length > 0 ? (
        <Table className="text-xs border">
          <TableHeader>
            <TableRow>
              <TableHead className="border">{labelHeader}</TableHead>
              <TableHead className="text-right border">{valueHeader}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vector.map((value, index) => (
              <TableRow key={rowHeaders[index] || `item-${index}`}>
                <TableCell className="font-medium border">{rowHeaders[index] || `Item ${index + 1}`}</TableCell>
                <TableCell className="text-right border">{value.toFixed(decimalPlaces)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : <p className="text-xs text-muted-foreground">Données non disponibles.</p>}
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <CardContent className="flex flex-col items-center space-y-4 pt-6">
            <p className="text-muted-foreground text-center">Commencez par choisir le type de réseau pour votre projet.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-md">
              {(['Alimentation', 'Evacuation'] as NetworkMainType[]).map(type => {
                const Icon = NetworkTypeIcons[type] || NetworkTypeIcons.Default;
                return (
                  <Button
                    key={type}
                    variant={networkMainType === type ? "default" : "outline"}
                    className="h-24 text-lg flex flex-col items-center justify-center space-y-2"
                    onClick={() => { 
                      setNetworkMainType(type); 
                      setSelectedSubtype(null); // Reset subtype when main type changes
                      setSelectedPN(null); // Reset PN when main type changes
                    }}
                  >
                    <Icon className="w-8 h-8 mb-1" />
                    <span>{type}</span>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        );
      case 2:
        const subtypes = networkMainType === 'Alimentation'
          ? ['EF', 'ECS'] as AlimentationSubtype[]
          : ['Eaux usées et vannes', 'Eaux pluviales'] as EvacuationSubtype[];
        return (
          <CardContent className="space-y-6 pt-6">
            <div>
              <Label className="text-base font-semibold">Type Spécifique de Réseau ({networkMainType})</Label>
              <RadioGroup
                value={selectedSubtype || undefined}
                onValueChange={(value) => setSelectedSubtype(value)}
                className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4"
              >
                {subtypes.map(subtype => (
                  <Label
                    key={subtype}
                    htmlFor={subtype}
                    className={`flex items-center space-x-2 border rounded-md p-3 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors ${selectedSubtype === subtype ? 'bg-primary text-primary-foreground border-primary ring-2 ring-primary' : 'bg-card'}`}
                  >
                    <RadioGroupItem value={subtype} id={subtype} />
                    <span>{subtype}</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>
            {networkMainType === 'Alimentation' && (
              <div>
                <Label htmlFor="pn-select" className="text-base font-semibold">Pression Nominale (PN)</Label>
                <Select value={selectedPN?.toString()} onValueChange={(v) => setSelectedPN(parseInt(v))}>
                  <SelectTrigger id="pn-select" className="w-full mt-2">
                    <SelectValue placeholder="Sélectionner PN" />
                  </SelectTrigger>
                  <SelectContent>
                    {pressureNominalValues.map(pn => (
                      <SelectItem key={pn} value={pn.toString()}>{pn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* Show alert if no materials are found based on current selections */}
            {selectedSubtype && (networkMainType === 'Evacuation' || (networkMainType === 'Alimentation' && selectedPN !== null)) && availableMaterials.length === 0 && (
                 <Alert variant="default" className="bg-accent/20 border-accent">
                    <Info className="h-4 w-4 text-accent-foreground" />
                    <AlertTitle className="text-accent-foreground">Aucun matériau compatible</AlertTitle>
                    <AlertDescription className="text-accent-foreground/80">
                        Aucun matériau dans notre base de données ne correspond à la combinaison de sous-type {networkMainType === 'Alimentation' ? 'et PN' : ''} sélectionnée. Veuillez essayer d'autres options ou vérifier vos sélections.
                    </AlertDescription>
                </Alert>
            )}
          </CardContent>
        );
      case 3:
        return (
          <CardContent className="space-y-4 pt-6">
            <Label className="text-base font-semibold">Matériaux Disponibles</Label>
            <p className="text-sm text-muted-foreground">
              Basé sur: {networkMainType} - {selectedSubtype}
              {networkMainType === 'Alimentation' && selectedPN !== null ? ` - PN ${selectedPN}` : ''}
            </p>
            {availableMaterials.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto p-1">
                {availableMaterials.map(material => (
                  <div
                    key={material.name}
                    className={`flex items-center space-x-3 p-3 border rounded-md transition-all hover:shadow-md cursor-pointer ${selectedMaterialNames.includes(material.name) ? 'bg-primary/10 border-primary ring-2 ring-primary/50' : 'bg-card'}`}
                    onClick={() => handleMaterialSelection(material.name)}
                  >
                    <Checkbox
                      id={`mat-${material.name}`}
                      checked={selectedMaterialNames.includes(material.name)}
                      onCheckedChange={() => handleMaterialSelection(material.name)} // Added to make checkbox clickable
                    />
                    <Label htmlFor={`mat-${material.name}`} className="font-medium cursor-pointer">{material.name}</Label>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">Aucun matériau compatible avec les sélections précédentes. Veuillez vérifier les spécifications à l'étape précédente.</p>
            )}
          </CardContent>
        );
      case 4:
        return (
          <CardContent className="space-y-4 pt-6">
            <Label className="text-base font-semibold">Critères d'Évaluation</Label>
             <p className="text-sm text-muted-foreground">Sélectionnez les critères pertinents pour votre analyse.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto p-1">
              {selectableCriteria.map(criterion => {
                const Icon = CriteriaIcons[criterion.key as CriterionKey] || CriteriaIcons.Default;
                return (
                  <div
                    key={criterion.key}
                    className={`flex items-center space-x-3 p-3 border rounded-md transition-all hover:shadow-md cursor-pointer ${selectedCriteriaKeys.includes(criterion.key) ? 'bg-primary/10 border-primary ring-2 ring-primary/50' : 'bg-card'}`}
                    onClick={() => handleCriteriaSelection(criterion.key as CriterionKey)}
                  >
                    <Checkbox
                      id={`crit-${criterion.key}`}
                      checked={selectedCriteriaKeys.includes(criterion.key as CriterionKey)}
                      onCheckedChange={() => handleCriteriaSelection(criterion.key as CriterionKey)} // Added to make checkbox clickable
                    />
                    <Icon className="w-5 h-5 text-muted-foreground" />
                    <Label htmlFor={`crit-${criterion.key}`} className="font-medium cursor-pointer">{criterion.label}</Label>
                  </div>
                );
              })}
            </div>
          </CardContent>
        );
      case 5:
        return (
          <CardContent className="space-y-6 pt-6">
            <div>
              <Label className="text-base font-semibold">Coûts des Matériaux (MAD/m)</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mt-2">
                {selectedMaterialNames.map(name => (
                  <div key={name} className="space-y-1">
                    <Label htmlFor={`cost-${name}`}>{name}</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id={`cost-${name}`}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={costSuggestions[name] ? `Ex: ${costSuggestions[name]}` : "Entrer coût"}
                        value={materialCosts[name] || ''}
                        onChange={e => setMaterialCosts(prev => ({ ...prev, [name]: e.target.value }))}
                        className="flex-grow"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSuggestCost(name)}
                        disabled={isSuggestingCost[name] || selectedPN === null} // Disabled if PN is not selected (e.g. for Evacuation)
                        aria-label={`Suggérer coût pour ${name}`}
                        title={selectedPN === null ? "PN requis pour la suggestion de coût" : "Suggérer coût"}
                      >
                        {isSuggestingCost[name] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-accent" />}
                        <span className="ml-2 hidden sm:inline">Suggérer</span>
                      </Button>
                    </div>
                     {costSuggestions[name] && <p className="text-xs text-muted-foreground">Suggestion IA: {costSuggestions[name]}</p>}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-base font-semibold">Pondérations des Critères (Somme = 1)</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mt-2">
                {selectedCriteriaKeys.map(key => {
                  const criterion = selectableCriteria.find(c => c.key === key);
                  return (
                    <div key={key} className="space-y-1">
                      <Label htmlFor={`weight-${key}`}>{criterion?.label || key}</Label>
                      <Input
                        id={`weight-${key}`}
                        type="number"
                        min="0"
                        max="1"
                        step="0.01"
                        placeholder="Ex: 0.25"
                        value={criteriaWeights[key as CriterionKey] || ''}
                        onChange={e => setCriteriaWeights(prev => ({ ...prev, [key as CriterionKey]: e.target.value }))}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        );
      case 6:
        if (!topsisResults || topsisResults.length === 0 || !calculationDetails) {
          return (
            <CardContent className="text-center py-10">
              <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
              <p className="text-xl font-semibold">Aucun résultat à afficher.</p>
              <p className="text-muted-foreground">Quelque chose s'est mal passé lors du calcul ou les données sont incomplètes.</p>
            </CardContent>
          );
        }
        const bestMaterial = topsisResults[0];
        const chartData = topsisResults.map(r => ({ name: r.name, score: parseFloat(r.score.toFixed(4)) })).sort((a,b) => b.score - a.score);
        const criteriaLabels = selectedCriteriaKeys.map(key => selectableCriteria.find(c => c.key === key)?.label || key);

        return (
          <CardContent className="space-y-8 pt-6">
            <Alert variant="default" className="bg-green-100 border-green-600 text-green-800 dark:bg-green-900/50 dark:border-green-500 dark:text-green-300">
              <CheckCircle2 className="h-5 w-5" />
              <AlertTitle className="font-bold">Matériau Recommandé: {bestMaterial.name}</AlertTitle>
              <AlertDescription>
                Score TOPSIS: <strong>{bestMaterial.score.toFixed(4)}</strong>. Ce matériau offre le meilleur compromis selon les critères et pondérations choisis.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-center">Visualisation des Scores</h3>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)'}}
                      labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                      itemStyle={{ color: 'hsl(var(--primary))' }}
                    />
                    <RechartsLegend wrapperStyle={{fontSize: "0.8rem"}} />
                    <Bar dataKey="score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-center">Classement Détaillé</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Rang</TableHead>
                    <TableHead>Matériau</TableHead>
                    <TableHead className="text-right">Score TOPSIS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topsisResults.map((result, index) => (
                    <TableRow key={result.name} className={index === 0 ? "bg-primary/10" : ""}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell>{result.name}</TableCell>
                      <TableCell className="text-right">{result.score.toFixed(4)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {calculationDetails && (
              <details className="space-y-2 bg-muted/50 p-4 rounded-md">
                <summary className="cursor-pointer font-semibold text-primary hover:underline">Afficher les détails du calcul TOPSIS</summary>
                <div className="mt-2 space-y-4 text-xs overflow-x-auto">
                  {renderMatrixAsTable(calculationDetails.initialMatrix, selectedMaterialNames, criteriaLabels, "Matrice Initiale", 2)}
                  {renderMatrixAsTable(calculationDetails.normalizedMatrix, selectedMaterialNames, criteriaLabels, "Matrice Normalisée", 3)}
                  {renderMatrixAsTable(calculationDetails.weightedMatrix, selectedMaterialNames, criteriaLabels, "Matrice Pondérée", 3)}
                  {renderVectorAsTable(calculationDetails.idealSolution, criteriaLabels, "Solution Idéale", "Valeur", "Critère", 3)}
                  {renderVectorAsTable(calculationDetails.antiIdealSolution, criteriaLabels, "Solution Anti-Idéale", "Valeur", "Critère", 3)}
                  {renderVectorAsTable(calculationDetails.distanceToIdeal, selectedMaterialNames, "Distances à la Solution Idéale (D+)", "Distance (D+)", "Matériau", 3)}
                  {renderVectorAsTable(calculationDetails.distanceToAntiIdeal, selectedMaterialNames, "Distances à la Solution Anti-Idéale (D-)", "Distance (D-)", "Matériau", 3)}
                  
                  <div className="my-4">
                    <h4 className="font-semibold mb-2 text-sm">Critères Sélectionnés:</h4>
                    {selectedCriteriaKeys.length > 0 ? (
                      <Table className="text-xs border">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="border">Critère</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                        {selectedCriteriaKeys.map(key => (
                            <TableRow key={key}>
                                <TableCell className="font-medium border">{selectableCriteria.find(c => c.key === key)?.label || key}</TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                      </Table>
                    ) : <p className="text-xs text-muted-foreground">Aucun critère sélectionné.</p>}
                  </div>

                  {renderVectorAsTable(
                    selectedCriteriaKeys.map(key => parseFloat(criteriaWeights[key] || "0")),
                    selectedCriteriaKeys.map(key => selectableCriteria.find(c => c.key === key)?.label || key),
                    "Pondérations Utilisées",
                    "Poids",
                    "Critère",
                    3
                  )}
                </div>
              </details>
            )}

            <div className="flex justify-center space-x-4 mt-6">
                <Button variant="outline" onClick={() => window.print()}>
                    <Printer className="mr-2 h-4 w-4" /> Imprimer / Enregistrer PDF
                </Button>
            </div>
          </CardContent>
        );
      default:
        return <p>Étape inconnue.</p>;
    }
  };

  return (
    <main className="container mx-auto px-4 py-8 flex flex-col items-center min-h-screen">
      <Card className="w-full max-w-3xl shadow-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Image src="https://placehold.co/100x100.png" alt="MaterialWise Logo" data-ai-hint="gears plumbing" width={80} height={80} className="rounded-full" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">MaterialWise</CardTitle>
          <CardDescription className="text-lg">Assistant de Sélection de Matériaux</CardDescription>
        </CardHeader>
        
        <div className="p-6">
          <StepIndicator currentStep={currentStep} totalSteps={stepNames.length} stepNames={stepNames} />
        </div>

        {renderStepContent()}

        <CardFooter className="flex justify-between pt-6 border-t">
          {currentStep > 1 && (
            <Button variant="outline" onClick={handlePrevStep}>
              <ChevronLeft className="mr-2 h-4 w-4" /> Précédent
            </Button>
          )}
          {currentStep < 6 ? (
            <Button onClick={handleNextStep} className="ml-auto">
              Suivant <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleRestart} className="ml-auto" variant="default">
              <RefreshCw className="mr-2 h-4 w-4" /> Recommencer
            </Button>
          )}
        </CardFooter>
      </Card>
      <footer className="text-center mt-8 text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} MaterialWise. Développé par Hajjou Mohammed. Adapté pour le web.</p>
      </footer>
    </main>
  );
}
