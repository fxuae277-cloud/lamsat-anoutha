import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Customer, Sale, Branch } from "@shared/schema";
import { Search, Plus, Edit2, Phone, Calendar, ShoppingBag, MapPin } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

type CustomerWithInvoices = Customer & {
  sales: (Sale & { branch: Branch })[];
};

export default function Customers() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithInvoices | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState("");

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: customerDetails } = useQuery<CustomerWithInvoices>({
    queryKey: [`/api/customers/${selectedCustomer?.id}`],
    enabled: !!selectedCustomer?.id,
  });

  const updateCustomerMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const res = await apiRequest("PUT", `/api/customers/${selectedCustomer?.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${selectedCustomer?.id}`] });
      setIsEditingName(false);
      toast({ title: t("customers.customer_saved") });
    },
  });

  const createCustomerMutation = useMutation({
    mutationFn: async (data: { name: string; phone: string }) => {
      const res = await apiRequest("POST", "/api/customers/find-or-create", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setIsAddOpen(false);
      toast({ title: t("customers.customer_created") });
    },
  });

  const filteredCustomers = customers.filter(c => 
    (c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
     c.phone?.includes(searchTerm))
  );

  const handleRowClick = (customer: Customer) => {
    setSelectedCustomer(customer as CustomerWithInvoices);
    setIsDetailOpen(true);
    setNewName(customer.name || "");
  };

  const handleAddCustomer = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const phone = formData.get("phone") as string;
    if (!name || !phone) {
      toast({ 
        title: t("common.error"), 
        description: !name ? t("customers.name_required") : t("customers.phone_required"),
        variant: "destructive" 
      });
      return;
    }
    createCustomerMutation.mutate({ name, phone });
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("customers.page_title")}</h1>
        </div>
        <Button onClick={() => setIsAddOpen(true)} data-testid="button-add-customer">
          <Plus className="h-4 w-4 mr-2 ml-2" />
          {t("customers.add_customer")}
        </Button>
      </div>

      <div className="flex items-center space-x-2 rtl:space-x-reverse">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("customers.search_placeholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-customers"
          />
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("customers.name")}</TableHead>
              <TableHead>{t("customers.phone")}</TableHead>
              <TableHead>{t("customers.visits")}</TableHead>
              <TableHead>{t("customers.total_spent")}</TableHead>
              <TableHead>{t("customers.last_visit")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">{t("common.loading")}</TableCell>
              </TableRow>
            ) : filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">{t("customers.no_customers")}</TableCell>
              </TableRow>
            ) : (
              filteredCustomers.map((customer) => (
                <TableRow 
                  key={customer.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(customer)}
                  data-testid={`row-customer-${customer.id}`}
                >
                  <TableCell className="font-medium">{customer.name || "---"}</TableCell>
                  <TableCell>{customer.phone}</TableCell>
                  <TableCell>{customer.visits}</TableCell>
                  <TableCell>{Number(customer.totalSpent).toFixed(3)} {t("common.omr")}</TableCell>
                  <TableCell>
                    {customer.lastVisit ? format(new Date(customer.lastVisit), "yyyy-MM-dd HH:mm") : "---"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Customer Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("customers.customer_detail")}</DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
            <Card className="md:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  {t("customers.name")}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setIsEditingName(!isEditingName)}
                    data-testid="button-edit-name"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isEditingName ? (
                  <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <Input 
                      value={newName} 
                      onChange={(e) => setNewName(e.target.value)}
                      data-testid="input-edit-name"
                    />
                    <Button 
                      size="sm" 
                      onClick={() => updateCustomerMutation.mutate({ name: newName })}
                      disabled={updateCustomerMutation.isPending}
                      data-testid="button-save-name"
                    >
                      {t("common.save")}
                    </Button>
                  </div>
                ) : (
                  <p className="text-2xl font-bold" data-testid="text-customer-name">{customerDetails?.name || "---"}</p>
                )}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Phone className="h-4 w-4 mr-2 ml-2" />
                    <span data-testid="text-customer-phone">{customerDetails?.phone}</span>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <ShoppingBag className="h-4 w-4 mr-2 ml-2" />
                    <span>{t("customers.visits")}: {customerDetails?.visits}</span>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 mr-2 ml-2" />
                    <span>{t("customers.total_spent")}: {Number(customerDetails?.totalSpent || 0).toFixed(3)} {t("common.omr")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">{t("customers.invoices_list")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("dashboard.order_number").replace("#{0}", "")}</TableHead>
                        <TableHead>{t("common.date")}</TableHead>
                        <TableHead>{t("common.total")}</TableHead>
                        <TableHead>{t("common.branch")}</TableHead>
                        <TableHead>{t("common.method")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!customerDetails?.sales || customerDetails.sales.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-4">{t("customers.no_invoices")}</TableCell>
                        </TableRow>
                      ) : (
                        customerDetails.sales.map((sale) => (
                          <TableRow key={sale.id} data-testid={`row-invoice-${sale.id}`}>
                            <TableCell className="font-medium">#{sale.invoiceNumber}</TableCell>
                            <TableCell>{format(new Date(sale.createdAt!), "yyyy-MM-dd")}</TableCell>
                            <TableCell>{Number(sale.total).toFixed(3)}</TableCell>
                            <TableCell>
                              <div className="flex items-center">
                                <MapPin className="h-3 w-3 mr-1 ml-1" />
                                {sale.branch?.name}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {t(`payment_methods.${sale.paymentMethod}`)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Customer Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("customers.add_customer")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddCustomer} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("customers.name")}</label>
              <Input name="name" placeholder={t("customers.name")} data-testid="input-customer-name" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("customers.phone")}</label>
              <Input name="phone" placeholder={t("customers.phone")} data-testid="input-customer-phone" />
            </div>
            <DialogFooter>
              <Button 
                type="submit" 
                disabled={createCustomerMutation.isPending}
                data-testid="button-submit-customer"
              >
                {createCustomerMutation.isPending ? t("common.saving") : t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
