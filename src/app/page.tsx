'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend as RechartsLegend, ResponsiveContainer } from 'recharts';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Download, Info, Loader2, Printer, Sparkles, RefreshCw } from 'lucide-react';
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
  
  const [materialCosts, setMaterialCosts] = useState<Record<string, string>>({}); // Store as string for input
  const [criteriaWeights, setCriteriaWeights] = useState<Record<CriterionKey, string>>({}); // Store as string for input

  const [topsisResults, setTopsisResults] = useState<TopsisFullResults[] | null>(null);
  const [calculationDetails, setCalculationDetails] = useState<Omit<TopsisFullResults, keyof TopsisResult | 'name' | 'score' | 'originalData' | 'calculatedValues'> | null>(null);


  const [costSuggestions, setCostSuggestions] = useState<Record<string, string>>({});
  const [isSuggestingCost, setIsSuggestingCost] = useState<Record<string, boolean>>({});
  
  const { toast } = useToast();

  useEffect(() => {
    if (networkMainType && selectedSubtype && selectedPN !== null) {
      const mappedType = networkMainType === 'Evacuation' ? 'EV' : selectedSubtype;
      const filtered = materialsDb.filter(m => 
        m.type.includes(mappedType as string) && m.pn.includes(selectedPN)
      );
      setAvailableMaterials(filtered);
      setSelectedMaterialNames([]); // Reset selected materials when filters change
    } else {
      setAvailableMaterials([]);
    }
  }, [networkMainType, selectedSubtype, selectedPN]);

  useEffect(() => {
    let criteria = [...allCriteria];
    if (selectedSubtype !== 'ECS') {
      criteria = criteria.filter(c => c.key !== 'temp');
    }
    setSelectableCriteria(criteria);
    setSelectedCriteriaKeys([]); // Reset selected criteria
  }, [selectedSubtype]);


  const handleNextStep = () => {
    if (currentStep === 1 && !networkMainType) {
      toast({ title: "Erreur", description: "Veuillez choisir un type de réseau.", variant: "destructive" });
      return;
    }
    if (currentStep === 2 && (!selectedSubtype || selectedPN === null)) {
      toast({ title: "Erreur", description: "Veuillez sélectionner un sous-type et une pression nominale.", variant: "destructive" });
      return;
    }
    if (currentStep === 2 && availableMaterials.length === 0) {
       toast({ title: "Information", description: "Aucun matériau compatible trouvé pour les spécifications sélectionnées. Essayez d'autres options.", variant: "default" });
       return; // Prevent going to next step if no materials
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
      // Validate costs and weights
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
      if (Math.abs(totalWeight - 1.0) > 0.001) {
         toast({ title: "Erreur de Pondération", description: `La somme des pondérations (${totalWeight.toFixed(3)}) doit être égale à 1.00.`, variant: "destructive" });
         return;
      }
      
      // Prepare data for TOPSIS
      const selectedMaterialsData = materialsDb.filter(m => selectedMaterialNames.includes(m.name));
      const costsParsed = Object.fromEntries(Object.entries(materialCosts).map(([key, value]) => [key, parseFloat(value)]));
      const weightsParsed = Object.fromEntries(Object.entries(criteriaWeights).map(([key, value]) => [key as CriterionKey, parseFloat(value)]));
      
      const results = runTopsisCalculation({
        selectedMaterialsData,
        selectedCriteriaKeys,
        allCriteriaDefinition: allCriteria,
        costs: costsParsed,
        weights: weightsParsed,
      });
      setTopsisResults(results);
      if (results.length > 0) {
        const { initialMatrix, normalizedMatrix, weightedMatrix, idealSolution, antiIdealSolution, distanceToIdeal, distanceToAntiIdeal } = results[0];
        setCalculationDetails({ initialMatrix, normalizedMatrix, weightedMatrix, idealSolution, antiIdealSolution, distanceToIdeal, distanceToAntiIdeal });
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
    setSelectedMaterialNames([]);
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
    if (!material || selectedPN === null) {
      toast({ title: "Erreur", description: "Impossible de suggérer le coût. Informations manquantes.", variant: "destructive"});
      return;
    }

    setIsSuggestingCost(prev => ({ ...prev, [materialName]: true }));
    try {
      const input: SuggestMaterialCostsInput = {
        materialType: material.name, // Use specific material name as type for more accuracy
        pressureRating: selectedPN,
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
  
  const renderStepContent = () => {
    switch (currentStep) {
      case 1: // Select Network Type
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
                    onClick={() => { setNetworkMainType(type); setSelectedSubtype(null); setSelectedPN(null); }}
                  >
                    <Icon className="w-8 h-8 mb-1" />
                    <span>{type}</span>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        );
      case 2: // Select Subtype and PN
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
            {selectedSubtype && selectedPN !== null && availableMaterials.length === 0 && (
                 <Alert variant="default" className="bg-accent/20 border-accent">
                    <Info className="h-4 w-4 text-accent-foreground" />
                    <AlertTitle className="text-accent-foreground">Aucun matériau compatible</AlertTitle>
                    <AlertDescription className="text-accent-foreground/80">
                        Aucun matériau dans notre base de données ne correspond à la combinaison de sous-type et PN sélectionnée. Veuillez essayer d'autres options.
                    </AlertDescription>
                </Alert>
            )}
          </CardContent>
        );
      case 3: // Select Materials
        return (
          <CardContent className="space-y-4 pt-6">
            <Label className="text-base font-semibold">Matériaux Disponibles</Label>
            <p className="text-sm text-muted-foreground">Basé sur: {networkMainType} - {selectedSubtype} - PN {selectedPN}</p>
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
                      onCheckedChange={() => handleMaterialSelection(material.name)}
                    />
                    <Label htmlFor={`mat-${material.name}`} className="font-medium cursor-pointer">{material.name}</Label>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">Aucun matériau compatible avec les sélections précédentes.</p>
            )}
          </CardContent>
        );
      case 4: // Select Criteria
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
                      onCheckedChange={() => handleCriteriaSelection(criterion.key as CriterionKey)}
                    />
                    <Icon className="w-5 h-5 text-muted-foreground" />
                    <Label htmlFor={`crit-${criterion.key}`} className="font-medium cursor-pointer">{criterion.label}</Label>
                  </div>
                );
              })}
            </div>
          </CardContent>
        );
      case 5: // Set Costs and Weights
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
                        disabled={isSuggestingCost[name]}
                        aria-label={`Suggérer coût pour ${name}`}
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
      case 6: // Display Results
        if (!topsisResults || topsisResults.length === 0) {
          return (
            <CardContent className="text-center py-10">
              <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
              <p className="text-xl font-semibold">Aucun résultat à afficher.</p>
              <p className="text-muted-foreground">Quelque chose s'est mal passé lors du calcul.</p>
            </CardContent>
          );
        }
        const bestMaterial = topsisResults[0];
        const chartData = topsisResults.map(r => ({ name: r.name, score: parseFloat(r.score.toFixed(4)) })).sort((a,b) => b.score - a.score);

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
                  <h4>Matrice Initiale:</h4>
                  <pre className="p-2 bg-background rounded">{JSON.stringify(calculationDetails.initialMatrix.map(row => row.map(v => v.toFixed(2))), null, 2)}</pre>
                  <h4>Matrice Normalisée:</h4>
                  <pre className="p-2 bg-background rounded">{JSON.stringify(calculationDetails.normalizedMatrix.map(row => row.map(v => v.toFixed(3))), null, 2)}</pre>
                  <h4>Matrice Pondérée:</h4>
                  <pre className="p-2 bg-background rounded">{JSON.stringify(calculationDetails.weightedMatrix.map(row => row.map(v => v.toFixed(3))), null, 2)}</pre>
                  <h4>Solution Idéale:</h4>
                  <pre className="p-2 bg-background rounded">{JSON.stringify(calculationDetails.idealSolution.map(v => v.toFixed(3)), null, 2)}</pre>
                  <h4>Solution Anti-Idéale:</h4>
                  <pre className="p-2 bg-background rounded">{JSON.stringify(calculationDetails.antiIdealSolution.map(v => v.toFixed(3)), null, 2)}</pre>
                  <h4>Distances à la Solution Idéale (D+):</h4>
                  <pre className="p-2 bg-background rounded">{JSON.stringify(calculationDetails.distanceToIdeal.map(v => v.toFixed(3)), null, 2)}</pre>
                  <h4>Distances à la Solution Anti-Idéale (D-):</h4>
                  <pre className="p-2 bg-background rounded">{JSON.stringify(calculationDetails.distanceToAntiIdeal.map(v => v.toFixed(3)), null, 2)}</pre>
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
